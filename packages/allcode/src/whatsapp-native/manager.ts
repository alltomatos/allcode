import path from "node:path"
import { Context, Effect, Fiber, Option, Schedule, Duration } from "effect"
import { Global } from "@allcode/core/global"
import { debug } from "@/util/debug"
import { WaClient } from "zapo-js"
import type { WaConnectionEvent, WaIncomingMessageEvent } from "zapo-js"
import { Provider } from "@/provider/provider"
import { InstanceStore } from "@/project/instance-store"
import { InstanceRef } from "@/effect/instance-ref"
import { getWhatsAppNativeStore } from "./store"
import { runReminderAction } from "./reminder-actions"
import {
  describeMedia,
  failedMedia,
  processMedia,
  type MediaProcessors,
  type PromptAttachment,
} from "./inbound-media"
import { transcribeAudio } from "./transcribe"
import {
  WhatsAppNativeState,
  WhatsAppNativeStatus,
  WhatsAppNativeEvent,
  WhatsAppNativeNotConfiguredError,
  WhatsAppNativeStateError,
  WhatsAppNativeOperationError,
} from "./schema"
import { ConfigAgentUIV1 } from "@allcode/core/v1/config/agentui"
import type { ChannelAgentUI } from "./bindings"

const DEBOUNCE_MS = 2500
const MAX_INBOUND_BYTES = 20 * 1024 * 1024

interface PendingBatch {
  texts: string[]
  attachments: PromptAttachment[]
  fiber: Fiber.Fiber<void, never>
}

interface InboundText {
  readonly text: string
  /** true when the message is a tap on a button/list/carousel we sent. */
  readonly interactive: boolean
  /** id cru do botão/linha tocado, quando houver. */
  readonly id?: string
}

function joinText(caption: string, media: string): string {
  return [caption.trim(), media.trim()].filter(Boolean).join("\n\n")
}

/**
 * Extrai o que o agente precisa ver de uma mensagem recebida. Respostas de
 * botões e listas não vêm em `conversation`/`extendedTextMessage`: chegam em
 * campos próprios do proto. Sem isso o tap era descartado como "texto vazio"
 * e o agente nunca sabia qual opção o usuário escolheu.
 *
 * Quando o cliente manda o texto exibido e o id são diferentes, preservamos os
 * dois — o agente usa o texto para a conversa e o id para identificar a ação.
 */
function inboundText(message: WaIncomingMessageEvent["message"]): InboundText {
  if (!message) return { text: "", interactive: false }

  const withId = (display: string | null | undefined, id: string | null | undefined, kind: string) => {
    const value = display?.trim()
    if (id) {
      return { text: value && value !== id ? `${value}\n[${kind}: ${id}]` : id, interactive: true, id }
    }
    return value ? { text: value, interactive: true } : undefined
  }

  const button = withId(
    message.buttonsResponseMessage?.selectedDisplayText,
    message.buttonsResponseMessage?.selectedButtonId,
    "button_id",
  )
  if (button) return button

  const list = withId(
    message.listResponseMessage?.title,
    message.listResponseMessage?.singleSelectReply?.selectedRowId,
    "list_id",
  )
  if (list) return list

  const template = withId(
    message.templateButtonReplyMessage?.selectedDisplayText,
    message.templateButtonReplyMessage?.selectedId,
    "button_id",
  )
  if (template) return template

  const response = message.interactiveResponseMessage
  if (response) {
    const params = response.nativeFlowResponseMessage?.paramsJson
    let id: string | undefined
    if (params) {
      try {
        const parsed = JSON.parse(params) as Record<string, unknown>
        const candidate = parsed.id ?? parsed.selectedId ?? parsed.row_id ?? parsed.rowId
        if (typeof candidate === "string" && candidate) id = candidate
      } catch {
        // paramsJson não é JSON — cai no texto do body
      }
    }
    const result = withId(response.body?.text, id, "button_id")
    if (result) return result
  }

  const text =
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ""
  return { text, interactive: false }
}

export interface AgentNativeSession {
  readonly agentId: string
  client?: WaClient
  state: WhatsAppNativeState
  qr?: string
  ttlMs?: number
  lastError?: string
  connectedAt?: number
  meJid?: string
  phone?: string
  fiber?: Fiber.Fiber<void, unknown>
  listeners: Set<(event: WhatsAppNativeEvent) => void>
}

export class WhatsAppNativeManager {
  private sessions = new Map<string, AgentNativeSession>()
  private storePromise = getWhatsAppNativeStore()
  private processedMessageIds = new Set<string>()
  private pendingBatches = new Map<string, PendingBatch>()

  getSession(agentId: string): AgentNativeSession | undefined {
    return this.sessions.get(agentId)
  }

  listSessions(): AgentNativeSession[] {
    return [...this.sessions.values()]
  }

  getStore() {
    return this.storePromise
  }

  getStatus(agentId: string): WhatsAppNativeStatus {
    const session = this.sessions.get(agentId)
    if (!session) {
      return {
        agentId,
        state: "idle",
      }
    }
    return {
      agentId,
      state: session.state,
      meJid: session.meJid,
      phone: session.phone,
      connectedAt: session.connectedAt,
      lastError: session.lastError,
    }
  }

  addListener(agentId: string, listener: (event: WhatsAppNativeEvent) => void): () => void {
    let session = this.sessions.get(agentId)
    if (!session) {
      session = {
        agentId,
        state: "idle",
        listeners: new Set(),
      }
      this.sessions.set(agentId, session)
    }
    session.listeners.add(listener)
    listener({
      agentId,
      state: session.state,
      qr: session.qr,
      ttlMs: session.ttlMs,
      error: session.lastError,
      phone: session.phone,
    })
    return () => {
      session?.listeners.delete(listener)
    }
  }

  private notify(session: AgentNativeSession, eventPartial: Partial<WhatsAppNativeEvent>) {
    const event: WhatsAppNativeEvent = {
      agentId: session.agentId,
      state: session.state,
      qr: session.qr,
      ttlMs: session.ttlMs,
      error: session.lastError,
      phone: session.phone,
      ...eventPartial,
    }
    for (const listener of session.listeners) {
      try {
        listener(event)
      } catch {
        // Ignora erros de listener individual
      }
    }
  }

  connect(
    agentId: string,
    channel: ConfigAgentUIV1.WhatsAppChannelBinding,
    agentUI: ChannelAgentUI,
  ): Effect.Effect<WhatsAppNativeStatus, WhatsAppNativeOperationError | WhatsAppNativeStateError> {
    const self = this
    return Effect.gen(function* () {
      let session = self.sessions.get(agentId)
      if (session?.state === "connected" || session?.state === "connecting") {
        return self.getStatus(agentId)
      }

      // Contexto do grafo que chamou connect (servidor/HTTP). O callback do
      // WebSocket roda fora de qualquer Effect, então guardamos o contexto para
      // reidratar serviços (Catalog, Integration, LocationServiceMap, ...) no
      // dispatch inbound — o runtime padrão do Effect não os possui.
      const appContext = yield* Effect.context<never>()

      const { store } = yield* Effect.tryPromise({
        try: () => self.storePromise,
        catch: (err) =>
          new WhatsAppNativeOperationError({
            message: `Falha ao carregar banco SQLite nativo do WhatsApp: ${String(err)}`,
            agentId,
          }),
      })

      if (!session) {
        session = {
          agentId,
          state: "connecting",
          listeners: new Set(),
        }
        self.sessions.set(agentId, session)
      } else {
        session.state = "connecting"
        session.lastError = undefined
      }
      self.notify(session, { state: "connecting" })
      debug(`[WhatsApp Native] connect iniciado agentId=${agentId}`)

      const client = yield* Effect.try({
        try: () =>
          new WaClient({
            store,
            sessionId: agentId,
            deviceBrowser: channel.native?.deviceBrowser || "chrome",
            deviceOsDisplayName: channel.native?.deviceOsDisplayName || "Windows",
          }),
        catch: (err) => {
          session!.state = "error"
          session!.lastError = `Falha ao criar cliente nativo: ${String(err)}`
          return new WhatsAppNativeOperationError({ message: session!.lastError, agentId })
        },
      })
      session.client = client

      // Handlers de evento da biblioteca zapo-js
      client.on("auth_qr", (event: { qr: string; ttlMs?: number }) => {
        session!.state = "qr_ready"
        session!.qr = event.qr
        session!.ttlMs = event.ttlMs ?? 60000
        self.notify(session!, { state: "qr_ready", qr: event.qr, ttlMs: session!.ttlMs })
      })

      client.on("auth_paired", () => {
        session!.state = "paired"
        session!.qr = undefined
        self.notify(session!, { state: "paired" })
      })

      client.on("connection", (event: WaConnectionEvent) => {
        if (event.status === "open") {
          session!.state = "connected"
          session!.qr = undefined
          session!.connectedAt = Date.now()
          session!.lastError = undefined
          try {
            const creds = client.getCredentials()
            if (creds?.meJid) {
              session!.meJid = creds.meJid
              session!.phone = creds.meJid.split("@")[0].split(":")[0]
            }
          } catch {
            // ignore
          }
          self.notify(session!, { state: "connected", phone: session!.phone })
        } else if (event.status === "close") {
          session!.state = "disconnected"
          session!.connectedAt = undefined
          if (event.isLogout) {
            session!.lastError = "Desconectado pelo WhatsApp no aparelho (logout)"
            session!.meJid = undefined
            session!.phone = undefined
          } else {
            session!.lastError = event.reason ? String(event.reason) : "Conexão fechada"
          }
          self.notify(session!, {
            state: "disconnected",
            error: session!.lastError,
          })
        }
      })

      // Listener de mensagens recebidas (Inbound).
      // O dispatch precisa rodar no runtime da aplicação — o prompt da sessão
      // depende de serviços (LocationServiceMap, Database, Catalog, Integration, ...)
      // que não existem no runtime padrão do Effect.
      client.on("message", (msgEvent: WaIncomingMessageEvent) => {
        const effect = Effect.gen(function* () {
          // Recarrega dinamicamente a versão mais recente do canal e do agente salvos no AgentUI
          const freshAgent = yield* agentUI.get(agentId).pipe(Effect.orElseSucceed(() => undefined))
          const freshChannel = (freshAgent?.channels as readonly ConfigAgentUIV1.WhatsAppChannelBinding[] | undefined)?.find(
            (c) => c.type === "whatsapp" && ConfigAgentUIV1.isNativeWhatsAppChannel(c),
          )
          yield* self.handleInboundMessage({
            agentId,
            channel: freshChannel ?? channel,
            client,
            msgEvent,
            agentUI,
            appContext,
          })
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => {
              console.error("[WhatsApp Inbound FATAL]", String(cause))
            }),
          ),
        )

        const runnable = Effect.provideContext(appContext)(effect)
        Effect.runFork(runnable)
      })

      // Inicia a conexão
      yield* Effect.tryPromise({
        try: () => client.connect(),
        catch: (err) =>
          new WhatsAppNativeOperationError({
            message: `Falha ao iniciar conexão WaClient: ${String(err)}`,
            agentId,
          }),
      }).pipe(
        Effect.tap(() =>
          Effect.sync(() =>
            debug(`[WhatsApp Native] client.connect() resolvido agentId=${agentId} state=${session!.state}`),
          ),
        ),
        Effect.tapError((err) =>
          Effect.sync(() => console.error(`[WhatsApp Native] client.connect() falhou agentId=${agentId}:`, String(err))),
        ),
      )

      return self.getStatus(agentId)
    })
  }

  /**
   * Encerra a conexão sem apagar credenciais (diferente de `logout`). Usado
   * quando o agente deixa de ser `native`/deixa de existir: sem isso, trocar o
   * modo no painel deixaria um cliente nativo órfão disputando a sessão.
   */
  disconnect(agentId: string): Effect.Effect<void, WhatsAppNativeOperationError> {
    const self = this
    return Effect.gen(function* () {
      const session = self.sessions.get(agentId)
      if (!session) return

      if (session.client) {
        yield* Effect.tryPromise({
          try: async () => {
            await session.client?.disconnect?.().catch(() => {})
          },
          catch: (err) =>
            new WhatsAppNativeOperationError({
              message: `Erro ao desconectar a sessão ${agentId}: ${String(err)}`,
              agentId,
            }),
        })
      }

      session.state = "disconnected"
      session.qr = undefined
      session.connectedAt = undefined
      self.notify(session, { state: "disconnected" })
      self.sessions.delete(agentId)
    })
  }

  logout(agentId: string): Effect.Effect<void, WhatsAppNativeOperationError> {
    const self = this
    return Effect.gen(function* () {
      const session = self.sessions.get(agentId)
      if (!session) return

      if (session.client) {
        yield* Effect.tryPromise({
          try: async () => {
            await session.client?.logout?.().catch(() => {})
            await session.client?.disconnect?.().catch(() => {})
          },
          catch: (err) =>
            new WhatsAppNativeOperationError({
              message: `Erro ao efetuar logout da sessão ${agentId}: ${String(err)}`,
              agentId,
            }),
        })
      }

      session.state = "disconnected"
      session.qr = undefined
      session.meJid = undefined
      session.phone = undefined
      session.connectedAt = undefined
      session.lastError = undefined
      self.notify(session, { state: "disconnected" })
      self.sessions.delete(agentId)
    })
  }

  private handleInboundMessage(input: {
    agentId: string
    channel: ConfigAgentUIV1.WhatsAppChannelBinding
    client: WaClient
    msgEvent: WaIncomingMessageEvent
    agentUI: ChannelAgentUI
    appContext: Context.Context<never>
  }): Effect.Effect<void, never, never> {
    const { agentId, channel, client, msgEvent, agentUI, appContext } = input
    const self = this
    const session = self.sessions.get(agentId)
    return Effect.gen(function* () {
      debug("[WhatsApp Native Inbound Raw Event]:", JSON.stringify({
        key: msgEvent.key,
        messageKeys: msgEvent.message ? Object.keys(msgEvent.message) : [],
        pushName: msgEvent.pushName,
      }))

      // Mensagens enviadas pelo próprio bot
      if (msgEvent.key?.fromMe) return

      // Deduplicação: se a mensagem já foi processada recentemente, ignora
      const messageId = msgEvent.key?.id
      if (messageId) {
        if (self.processedMessageIds.has(messageId)) {
          debug(`[WhatsApp Inbound Ignored] Mensagem duplicada já processada: id=${messageId}`)
          return
        }
        self.processedMessageIds.add(messageId)
        if (self.processedMessageIds.size > 2000) {
          const first = self.processedMessageIds.values().next().value
          if (first) self.processedMessageIds.delete(first)
        }
      }

      const chatJid = msgEvent.key?.remoteJid
      if (!chatJid) return

      const isGroup = msgEvent.key.isGroup ?? chatJid.endsWith("@g.us")
      // Em grupos o WhatsApp pode endereçar o autor por LID (@lid); `participantAlt`
      // traz o PN (@s.whatsapp.net) equivalente, que é o que o usuário digita nas
      // listas de autorizados. Consideramos as duas formas.
      const senderJid = msgEvent.key.participant || chatJid
      const senderPhone = senderJid.split("@")[0].split(":")[0]
      const senderAlt = (msgEvent.key as { participantAlt?: string }).participantAlt
      const isSenderAllowed = (entries: readonly string[]) =>
        entries.some(
          (entry) =>
            entry.includes(senderPhone) ||
            senderJid.includes(entry) ||
            (senderAlt ? entry.includes(senderAlt.split("@")[0].split(":")[0]) || senderAlt.includes(entry) : false),
        )

      const nativeOpts = channel.native

      debug(
        `[WhatsApp Inbound Filter Check] chat=${chatJid} isGroup=${isGroup} sender=${senderJid} senderAlt=${senderAlt} allowedGroups=${JSON.stringify(channel.allowedGroups)}`,
      )

      // 0. Toggle de mensagens diretas e grupos
      if (!isGroup && nativeOpts?.directMessagesEnabled === false) {
        debug("[WhatsApp Inbound Ignored] Direct messages are disabled")
        return
      }
      if (isGroup && nativeOpts?.groupsEnabled === false) {
        debug("[WhatsApp Inbound Ignored] Groups are disabled")
        return
      }

      // 1. Filtro de Grupos autorizados
      if (isGroup && channel.allowedGroups && channel.allowedGroups.length > 0) {
        if (!channel.allowedGroups.includes(chatJid)) {
          debug(`[WhatsApp Inbound Ignored] Group ${chatJid} is not in allowedGroups`)
          return
        }
      }

      // 2. Filtro de Remetentes permitidos globalmente
      if (channel.allowedSenders && channel.allowedSenders.length > 0) {
        const allowed = isSenderAllowed(channel.allowedSenders)
        if (!allowed) {
          debug(`[WhatsApp Inbound Ignored] Sender ${senderJid} not in allowedSenders`)
          return
        }
      }

      // 3. Filtro de Remetentes permitidos por grupo específico
      if (isGroup && channel.groupAllowedSenders && channel.groupAllowedSenders[chatJid]) {
        const groupSenders = channel.groupAllowedSenders[chatJid]
        if (groupSenders.length > 0) {
          const allowed = isSenderAllowed(groupSenders)
          if (!allowed) {
            debug(`[WhatsApp Inbound Ignored] Sender ${senderJid} not in groupAllowedSenders for ${chatJid}`)
            return
          }
        }
      }

      const inbound = inboundText(msgEvent.message)
      const media = describeMedia(msgEvent.message)
      const text = inbound.text

      if (!text.trim() && !media) {
        debug("[WhatsApp Inbound Ignored] Text and media are empty")
        return
      }

      debug(`[WhatsApp Inbound Msg] "${text}" from ${senderJid} in ${chatJid}`)

      // 4. MentionOnly ou QuoteReply em grupos
      if (isGroup) {
        const contextInfo =
          msgEvent.message?.extendedTextMessage?.contextInfo ||
          msgEvent.message?.imageMessage?.contextInfo ||
          msgEvent.message?.videoMessage?.contextInfo ||
          msgEvent.message?.documentMessage?.contextInfo ||
          msgEvent.message?.audioMessage?.contextInfo

        const creds = client.getCredentials()
        // O WhatsApp endereça grupos por LID (@lid) e DMs por PN (@s.whatsapp.net).
        // Por isso comparamos contra as duas identidades do próprio bot.
        const digits = (value?: string) => (value ? value.split("@")[0].split(":")[0].replace(/\D+/g, "") : "")
        const botIds = [digits(creds?.meJid), digits(creds?.meLid)].filter(Boolean)
        const matchesBot = (jid?: string) => {
          if (!jid) return false
          const value = digits(jid)
          if (!value) return false
          return botIds.some((id) => value === id || value.includes(id) || id.includes(value))
        }

        // Verifica se o bot foi mencionado (@bot). O metadata `mentionedJid`
        // só existe quando o cliente monta a menção de verdade; mensagens
        // enviadas por gateways (izapia/API) costumam trazer apenas o texto
        // literal "@<numero>", então também procuramos por isso.
        const mentions: string[] = contextInfo?.mentionedJid ?? []
        const textMentionsBot = botIds.some((id) => text.includes(`@${id}`))
        const isMentioned = mentions.some((m) => matchesBot(m)) || textMentionsBot

        // Verifica se é resposta citando uma mensagem do próprio bot
        const isQuotingBot = matchesBot(contextInfo?.participant ?? undefined)

        debug(
          `[WhatsApp Mention/Quote Check] botIds=${JSON.stringify(botIds)} mentions=${JSON.stringify(mentions)} quoted=${contextInfo?.participant} isMentioned=${isMentioned} isQuotingBot=${isQuotingBot} mentionOnly=${channel.mentionOnly} replyToQuoteOrMentionOnly=${nativeOpts?.replyToQuoteOrMentionOnly}`,
        )

        // Responder a um botão/lista que o próprio bot enviou já é uma
        // interação explícita: não exige @menção nem quote. Os filtros de
        // grupo/remetente acima continuam valendo.
        if (inbound.interactive) {
          debug("[WhatsApp Inbound] interactive reply accepted without mention/quote")
        } else {
          // Se mentionOnly clássico estiver ligado
          if (channel.mentionOnly && !isMentioned) {
            debug("[WhatsApp Inbound Ignored] mentionOnly is true but bot was not mentioned")
            return
          }

          // Se a opção "Responder somente se mencionado OU se for resposta a mensagem do bot" estiver ativa
          if (nativeOpts?.replyToQuoteOrMentionOnly) {
            if (!isMentioned && !isQuotingBot) {
              debug("[WhatsApp Inbound Ignored] replyToQuoteOrMentionOnly is true but not mentioned and not quoting bot")
              return
            }
          }
        }
      }

      // Ação direta em botão de lembrete não precisa passar pelo modelo: o id
      // carrega o verbo e o schedule alvo (ver reminder-caller.ts).
      if (inbound.id?.startsWith("reminder:")) {
        yield* self.handleReminderAction({ client, chatJid, id: inbound.id })
        return
      }

      let promptText = text
      let attachments: PromptAttachment[] = []

      if (media) {
        // O download e a extração são isolados: qualquer falha vira contexto
        // textual para o agente e a fila continua com as próximas mensagens.
        const downloaded = yield* Effect.tryPromise({
          try: () =>
            client.message.downloadBytes(msgEvent, {
              maxBytes: MAX_INBOUND_BYTES,
              timeoutMs: 60_000,
            }),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        }).pipe(Effect.option)

        if (downloaded._tag === "None") {
          yield* Effect.logWarning(
            `[WhatsApp Media] falha no download de ${media.filename} (${media.mime}) para ${chatJid}`,
          )
          const processed = failedMedia(media, "falha no download do arquivo")
          promptText = joinText(promptText, processed.text)
        } else {
          const provider = Option.getOrUndefined(yield* Effect.serviceOption(Provider.Service))
          // Provider/Catálogo são InstanceState: sem o InstanceRef do projeto
          // do AgentUI o `provider.list()` volta vazio (ou falha como defeito).
          const transcriptionContext = yield* Effect.gen(function* () {
            const instances = Option.getOrUndefined(yield* Effect.serviceOption(InstanceStore.Service))
            if (!instances) return undefined
            const targetDirectory =
              channel.directory && path.isAbsolute(channel.directory)
                ? channel.directory
                : path.join(Global.Path.data, "projects", "agentui")
            return yield* instances
              .load({ directory: targetDirectory })
              .pipe(Effect.catchCause(() => Effect.succeed(undefined)))
          })
          const processors: MediaProcessors = {
            transcribe: (input) => {
              const effect = provider
                ? transcribeAudio(provider, input)
                : Effect.fail(new Error("provider indisponível para transcrição de áudio"))
              return transcriptionContext ? effect.pipe(Effect.provideService(InstanceRef, transcriptionContext)) : effect
            },
          }
          const processed = yield* processMedia({
            descriptor: media,
            bytes: downloaded.value,
            processors,
          }).pipe(
            // Nenhum anexo pode prender a fila de inbound indefinidamente
            // (ex.: provider de transcrição sem contexto/instância).
            Effect.timeoutOrElse({
              duration: Duration.seconds(120),
              orElse: () =>
                Effect.succeed(failedMedia(media, "tempo esgotado no processamento do anexo")),
            }),
          )
          promptText = joinText(promptText, processed.text)
          attachments = [...processed.attachments]
        }
      }

      if (!promptText.trim() && attachments.length === 0) {
        debug("[WhatsApp Inbound Ignored] Nothing to dispatch after media processing")
        return
      }

      // Enfileira mensagem no lote debounced para este chat/agente
      yield* self.enqueueInbound({
        agentId,
        channel,
        client,
        chatJid,
        text: promptText,
        attachments,
        agentUI,
        appContext,
      })
    }).pipe(
      Effect.catch(() => Effect.void),
    )
  }

  private handleReminderAction(input: {
    client: WaClient
    chatJid: string
    id: string
  }): Effect.Effect<void, never, never> {
    return Effect.gen(function* () {
      const reply = yield* runReminderAction(input.id)
      yield* Effect.tryPromise({
        try: () => input.client.message.send(input.chatJid, reply),
        catch: (error) => error,
      }).pipe(
        Effect.tapError((error) =>
          Effect.logWarning(`[WhatsApp Reminder Action] falha ao responder ${input.chatJid}: ${String(error)}`),
        ),
        Effect.catch(() => Effect.void),
      )
      debug(`[WhatsApp Reminder Action] id=${input.id} reply="${reply}"`)
    }).pipe(Effect.catch(() => Effect.void))
  }

  private enqueueInbound(input: {
    agentId: string
    channel: ConfigAgentUIV1.WhatsAppChannelBinding
    client: WaClient
    chatJid: string
    text: string
    attachments?: readonly PromptAttachment[]
    agentUI: ChannelAgentUI
    appContext: Context.Context<never>
  }): Effect.Effect<void, never, never> {
    const self = this
    return Effect.sync(() => {
      const key = `${input.agentId}:${input.chatJid}`
      const existing = self.pendingBatches.get(key)
      if (existing) {
        Effect.runFork(Fiber.interrupt(existing.fiber))
      }
      const texts = existing ? [...existing.texts, input.text] : [input.text]
      const attachments = [...(existing?.attachments ?? []), ...(input.attachments ?? [])]

      const task = Effect.sleep(Duration.millis(DEBOUNCE_MS)).pipe(
        Effect.andThen(() =>
          self.flushBatch({
            agentId: input.agentId,
            channel: input.channel,
            client: input.client,
            chatJid: input.chatJid,
            agentUI: input.agentUI,
            key,
          }),
        ),
        Effect.catchCause((cause) =>
          Effect.sync(() => {
            console.error("[WhatsApp Inbound Batch FATAL]", String(cause))
          }),
        ),
      )

      const fiber = Effect.runFork(Effect.provideContext(input.appContext)(task))
      self.pendingBatches.set(key, { texts, attachments, fiber })
    })
  }

  private flushBatch(input: {
    agentId: string
    channel: ConfigAgentUIV1.WhatsAppChannelBinding
    client: WaClient
    chatJid: string
    agentUI: ChannelAgentUI
    key: string
  }): Effect.Effect<void, never, never> {
    const self = this
    return Effect.gen(function* () {
      const batch = self.pendingBatches.get(input.key)
      self.pendingBatches.delete(input.key)
      if (!batch || (batch.texts.length === 0 && batch.attachments.length === 0)) return

      const aggregatedText = batch.texts.join("\n")
      debug(`[WhatsApp Inbound Dispatching Batch to AgentUI] agentId=${input.agentId} count=${batch.texts.length} text="${aggregatedText}"`)

      // Dispatch para o AgentUI
      const result = yield* input.agentUI
        .dispatchChannelMessage({
          id: input.agentId,
          directory: input.channel.directory || "default",
          chatKey: input.chatJid,
          message: aggregatedText,
          attachments: batch.attachments.length > 0 ? batch.attachments : undefined,
          channel: "whatsapp",
        })
        .pipe(
          Effect.catch((err) => {
            console.error("[WhatsApp Inbound dispatchChannelMessage error]:", err)
            return Effect.succeed({ reply: "", blocked: false })
          }),
        )

      debug(`[WhatsApp Inbound AgentUI Result] reply="${result.reply}" blocked=${result.blocked}`)

      if (!result.reply || result.reply === "(sem resposta)") {
        debug("[WhatsApp Inbound] Result reply is empty, skipping sending")
        return
      }

      debug(`[WhatsApp Inbound Sending Reply] to=${input.chatJid} text="${result.reply}"`)

      // Envia resposta de volta no mesmo chat com retentativa
      const sendResult = yield* Effect.tryPromise({
        try: () => input.client.message.send(input.chatJid, result.reply),
        catch: (err) => {
          console.error(`[WhatsApp client.message.send THREW] to=${input.chatJid}:`, err)
          return err
        },
      }).pipe(
        Effect.retry({
          schedule: Schedule.exponential(Duration.seconds(2)).pipe(Schedule.both(Schedule.recurs(3))),
        }),
        Effect.tapError((cause) => {
          console.error(`[WhatsApp Inbound send reply error] to=${input.chatJid}:`, cause)
          return Effect.logError("Falha ao enviar resposta WhatsApp nativa", {
            agentId: input.agentId,
            chatJid: input.chatJid,
            error: String(cause),
          })
        }),
        Effect.catch(() => Effect.void),
      )
      debug(`[WhatsApp Inbound Reply Sent Success] to=${input.chatJid} result=${JSON.stringify(sendResult)}`)
    }).pipe(
      Effect.catch(() => Effect.void),
    )
  }
}

// O grafo de servi�os � constru�do mais de uma vez no mesmo processo (rotas
// HTTP, ToolRegistry, AppRuntime). Se cada constru��o criasse o seu manager,
// ter�amos N supervisores disputando a MESMA sess�o do WhatsApp � reconex�es
// em loop, conten��o no SQLite e boot lento. O manager (e portanto a conex�o)
// � �nico por processo.
let sharedManager: WhatsAppNativeManager | undefined

export function getWhatsAppNativeManager(): WhatsAppNativeManager {
  return (sharedManager ??= new WhatsAppNativeManager())
}