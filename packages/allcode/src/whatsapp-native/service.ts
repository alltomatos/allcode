import { Context, Effect, Layer } from "effect"
import { debug } from "@/util/debug"
import { LayerNode } from "@allcode/core/effect/layer-node"
import type { WaClient } from "zapo-js"
import { getWhatsAppNativeManager } from "./manager"
import { whatsappNativeDbPath, whatsappNativeProfile } from "./store"
import {
  WhatsAppNativeStatus,
  WhatsAppNativeEvent,
  WhatsAppNativeNotConfiguredError,
  WhatsAppNativeStateError,
  WhatsAppNativeOperationError,
} from "./schema"
import { getAgentUI, type ChannelAgentUI } from "./bindings"
import { Global } from "@allcode/core/global"
import { ConfigAgentUIV1 } from "@allcode/core/v1/config/agentui"
import type { MediaKind } from "./media"
import type { QuoteRef } from "./send"
import { sendInteractive, sendMedia, sendReaction, sendText } from "./send"
import { sendCarousel as sendCarouselMessage, type CarouselCardRequest } from "./carousel"
import {
  addGroupParticipants,
  createGroup,
  demoteGroupParticipants,
  groupInviteLink,
  promoteGroupParticipants,
  queryGroupInfo,
  queryGroupParticipants,
  queryGroups,
  removeGroupParticipants,
  revokeGroupInvite,
  type GroupSummary,
} from "./groups"
import { listThreads, readMessages, type StoredMessage, type StoredThread } from "./history"
import {
  ctaUrlButton,
  listMessage,
  pixPaymentButton,
  quickReplyButtons,
  type ListSectionInput,
  type QuickReplyButtonInput,
} from "./interactive"

export interface Interface {
  readonly getStatus: (agentId: string) => Effect.Effect<WhatsAppNativeStatus>
  readonly connect: (
    agentId: string,
  ) => Effect.Effect<
    WhatsAppNativeStatus,
    WhatsAppNativeNotConfiguredError | WhatsAppNativeStateError | WhatsAppNativeOperationError
  >
  readonly logout: (agentId: string) => Effect.Effect<void, WhatsAppNativeOperationError>
  readonly subscribeEvents: (
    agentId: string,
    listener: (event: WhatsAppNativeEvent) => void,
  ) => Effect.Effect<() => void>
  readonly sendText: (input: {
    agentId: string
    to: string
    text: string
    quote?: QuoteRef
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly sendMedia: (input: {
    agentId: string
    to: string
    media: string
    kind?: MediaKind
    caption?: string
    mimetype?: string
    filename?: string
    quote?: QuoteRef
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly sendReaction: (input: {
    agentId: string
    chatId: string
    messageId: string
    emoji: string
    fromMe?: boolean
    participant?: string
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly sendButtons: (input: {
    agentId: string
    to: string
    body: string
    title?: string
    footer?: string
    buttons: readonly QuickReplyButtonInput[]
    quote?: QuoteRef
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly sendLinkButton: (input: {
    agentId: string
    to: string
    body: string
    label: string
    url: string
    title?: string
    footer?: string
    quote?: QuoteRef
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly sendList: (input: {
    agentId: string
    to: string
    body: string
    buttonText: string
    title?: string
    footer?: string
    sections: readonly ListSectionInput[]
    quote?: QuoteRef
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly sendPix: (input: {
    agentId: string
    to: string
    body: string
    key: string
    keyType?: "EVP" | "PHONE" | "EMAIL" | "CPF" | "CNPJ"
    merchantName?: string
    amountCents?: number
    referenceId?: string
    title?: string
    footer?: string
    quote?: QuoteRef
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly sendCarousel: (input: {
    agentId: string
    to: string
    body?: string
    cards: readonly CarouselCardRequest[]
    quote?: QuoteRef
  }) => Effect.Effect<{ messageId?: string }, WhatsAppNativeOperationError>
  readonly readMessages: (input: {
    agentId: string
    chatId: string
    limit?: number
    beforeTimestampMs?: number
  }) => Effect.Effect<StoredMessage[], WhatsAppNativeOperationError>
  readonly listChats: (input: {
    agentId: string
    limit?: number
  }) => Effect.Effect<StoredThread[], WhatsAppNativeOperationError>
  readonly listGroups: (input: { agentId: string; onlyAdmin?: boolean }) => Effect.Effect<
    GroupSummary[],
    WhatsAppNativeOperationError
  >
  readonly groupInfo: (input: {
    agentId: string
    groupId: string
  }) => Effect.Effect<
    Awaited<ReturnType<typeof queryGroupInfo>>,
    WhatsAppNativeOperationError
  >
  readonly listGroupParticipants: (input: {
    agentId: string
    groupId: string
  }) => Effect.Effect<
    {
      jid: string
      name?: string
      phone?: string
      isAdmin: boolean
      isSuperAdmin: boolean
    }[],
    WhatsAppNativeOperationError
  >
  readonly groupCreate: (input: {
    agentId: string
    subject: string
    participants: readonly string[]
  }) => Effect.Effect<{ jid: string; subject: string }, WhatsAppNativeOperationError>
  readonly groupUpdateParticipants: (input: {
    agentId: string
    groupId: string
    action: "add" | "remove" | "promote" | "demote"
    participants: readonly string[]
  }) => Effect.Effect<unknown[], WhatsAppNativeOperationError>
  readonly groupInvite: (input: {
    agentId: string
    groupId: string
    revoke?: boolean
  }) => Effect.Effect<{ code?: string; url?: string }, WhatsAppNativeOperationError>
}


export class Service extends Context.Service<Service, Interface>()("@opencode/WhatsAppNative") {}

let supervisorStarted = false

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    // Manager único por processo (ver manager.ts): evita dois supervisores
    // disputando a mesma sessão do WhatsApp quando o grafo é montado 2x.
    const manager = getWhatsAppNativeManager()
    debug(
      `[WhatsApp Native] serviço iniciado profile=${whatsappNativeProfile()} db=${whatsappNativeDbPath()} configDir=${Global.Path.config}`,
    )

    const getStatus = (agentId: string) => Effect.sync(() => manager.getStatus(agentId))

    const connect = (agentId: string) =>
      Effect.gen(function* () {
        // Resolvido por chamada: o AgentUI registra a instância no bindings
        // quando o layer dele é construído, que pode ser depois deste.
        const agentUI = getAgentUI()
        if (!agentUI) {
          return yield* Effect.fail(
            new WhatsAppNativeNotConfiguredError({
              message: "AgentUI indisponível no processo (bindings não registrado)",
              agentId,
            }),
          )
        }
        const agent = yield* agentUI.get(agentId).pipe(
          Effect.catch(() =>
            Effect.fail(new WhatsAppNativeNotConfiguredError({ message: `Agente ${agentId} não encontrado`, agentId })),
          ),
        )
        const found = (agent.channels as readonly ConfigAgentUIV1.WhatsAppChannelBinding[]).find(
          (c): c is ConfigAgentUIV1.WhatsAppChannelBinding =>
            c.type === "whatsapp" && ConfigAgentUIV1.isNativeWhatsAppChannel(c),
        )
        const channel: ConfigAgentUIV1.WhatsAppChannelBinding = found ?? {
          // Fallback para quando o usuário acabou de acionar a conexão nativa
          // e o canal ainda não foi salvo com mode: "native".
          type: "whatsapp",
          mode: "native",
          provider: ConfigAgentUIV1.WHATSAPP_NATIVE_PROVIDER_PLACEHOLDER,
          config: {},
        }
        return yield* manager.connect(agentId, channel, agentUI)
      })

    const logout = (agentId: string) => manager.logout(agentId)

    const subscribeEvents = (agentId: string, listener: (event: WhatsAppNativeEvent) => void) =>
      Effect.sync(() => manager.addListener(agentId, listener))

    const requireClient = (agentId: string): Effect.Effect<WaClient, WhatsAppNativeOperationError> =>
      Effect.gen(function* () {
        const session = manager.getSession(agentId)
        if (!session?.client || session.state !== "connected") {
          return yield* Effect.fail(
            new WhatsAppNativeOperationError({
              message: `Sessão WhatsApp nativa do agente ${agentId} não está conectada`,
              agentId,
            }),
          )
        }
        return session.client
      })

    const op = <A>(agentId: string, label: string, run: (client: WaClient) => Promise<A>) =>
      Effect.gen(function* () {
        const client = yield* requireClient(agentId)
        return yield* Effect.tryPromise({
          try: () => run(client),
          catch: (err) =>
            new WhatsAppNativeOperationError({
              message: `${label}: ${err instanceof Error ? err.message : String(err)}`,
              agentId,
            }),
        })
      })

    const sendTextOp = (input: { agentId: string; to: string; text: string; quote?: QuoteRef }) =>
      op(input.agentId, `Falha ao enviar texto para ${input.to}`, (client) => sendText(client, input))

    const sendMediaOp = (input: {
      agentId: string
      to: string
      media: string
      kind?: MediaKind
      caption?: string
      mimetype?: string
      filename?: string
      quote?: QuoteRef
    }) => op(input.agentId, `Falha ao enviar mídia para ${input.to}`, (client) => sendMedia(client, input))

    const sendReactionOp = (input: {
      agentId: string
      chatId: string
      messageId: string
      emoji: string
      fromMe?: boolean
      participant?: string
    }) => op(input.agentId, `Falha ao reagir em ${input.chatId}`, (client) => sendReaction(client, input))

    const sendButtons = (input: {
      agentId: string
      to: string
      body: string
      title?: string
      footer?: string
      buttons: readonly QuickReplyButtonInput[]
      quote?: QuoteRef
    }) =>
      op(input.agentId, `Falha ao enviar botões para ${input.to}`, (client) =>
        sendInteractive(client, { to: input.to, message: quickReplyButtons(input), quote: input.quote }),
      )

    const sendLinkButton = (input: {
      agentId: string
      to: string
      body: string
      label: string
      url: string
      title?: string
      footer?: string
      quote?: QuoteRef
    }) =>
      op(input.agentId, `Falha ao enviar botão de link para ${input.to}`, (client) =>
        sendInteractive(client, { to: input.to, message: ctaUrlButton(input), quote: input.quote }),
      )

    const sendList = (input: {
      agentId: string
      to: string
      body: string
      buttonText: string
      title?: string
      footer?: string
      sections: readonly ListSectionInput[]
      quote?: QuoteRef
    }) =>
      op(input.agentId, `Falha ao enviar lista para ${input.to}`, (client) =>
        sendInteractive(client, { to: input.to, message: listMessage(input), quote: input.quote }),
      )

    const sendPix = (input: {
      agentId: string
      to: string
      body: string
      key: string
      keyType?: "EVP" | "PHONE" | "EMAIL" | "CPF" | "CNPJ"
      merchantName?: string
      amountCents?: number
      referenceId?: string
      title?: string
      footer?: string
      quote?: QuoteRef
    }) =>
      op(input.agentId, `Falha ao enviar cobrança PIX para ${input.to}`, (client) =>
        sendInteractive(client, { to: input.to, message: pixPaymentButton(input), quote: input.quote }),
      )

    const sendCarousel = (input: {
      agentId: string
      to: string
      body?: string
      cards: readonly CarouselCardRequest[]
      quote?: QuoteRef
    }) =>
      op(input.agentId, `Falha ao enviar carrossel para ${input.to}`, (client) =>
        sendCarouselMessage(client, { to: input.to, body: input.body, cards: input.cards, quote: input.quote }),
      )

    const readMessagesOp = (input: {
      agentId: string
      chatId: string
      limit?: number
      beforeTimestampMs?: number
    }) => op(input.agentId, `Falha ao ler mensagens de ${input.chatId}`, () => readMessages(input))

    const listChats = (input: { agentId: string; limit?: number }) =>
      op(input.agentId, "Falha ao listar conversas", () => listThreads(input))

    const listGroups = (input: { agentId: string; onlyAdmin?: boolean }) =>
      op(input.agentId, "Falha ao listar grupos", (client) => queryGroups(client, input))

    const groupInfo = (input: { agentId: string; groupId: string }) =>
      op(input.agentId, `Falha ao obter dados do grupo ${input.groupId}`, (client) =>
        queryGroupInfo(client, input.groupId),
      )

    const listGroupParticipants = (input: { agentId: string; groupId: string }) =>
      op(input.agentId, `Falha ao obter participantes do grupo ${input.groupId}`, (client) =>
        queryGroupParticipants(client, input.groupId),
      )

    const groupCreate = (input: { agentId: string; subject: string; participants: readonly string[] }) =>
      op(input.agentId, `Falha ao criar grupo "${input.subject}"`, (client) => createGroup(client, input))

    const groupUpdateParticipants = (input: {
      agentId: string
      groupId: string
      action: "add" | "remove" | "promote" | "demote"
      participants: readonly string[]
    }) =>
      op(input.agentId, `Falha ao ${input.action} participantes do grupo ${input.groupId}`, (client) => {
        if (input.action === "add") return addGroupParticipants(client, input)
        if (input.action === "remove") return removeGroupParticipants(client, input)
        if (input.action === "promote") return promoteGroupParticipants(client, input)
        return demoteGroupParticipants(client, input)
      }) as Effect.Effect<unknown[], WhatsAppNativeOperationError>

    const groupInvite = (input: { agentId: string; groupId: string; revoke?: boolean }) =>
      op(input.agentId, `Falha ao obter link de convite do grupo ${input.groupId}`, (client) =>
        input.revoke ? revokeGroupInvite(client, input.groupId) : groupInviteLink(client, input.groupId),
      )

    const reconcileAgents = Effect.gen(function* () {
      const agentUI = getAgentUI()
      if (!agentUI) return
      const agents = yield* agentUI.list()
      const { store } = yield* Effect.tryPromise(() => manager.getStore()).pipe(
        Effect.catch(() => Effect.succeed({ store: undefined })),
      )

      // Agentes que deveriam ter uma sessão nativa agora. Qualquer sessão viva
      // fora deste conjunto (agente removido, desativado ou trocado para o modo
      // `external`) é encerrada — nunca deixamos duas conexões disputando a
      // mesma conta.
      const expected = new Set<string>()

      for (const agent of agents) {
        if (!ConfigAgentUIV1.isEnabled(agent)) {
          debug(`[WhatsApp Native Reconcile] agente desativado: ${agent.id}`)
          continue
        }
        const channel = (agent.channels as readonly ConfigAgentUIV1.WhatsAppChannelBinding[]).find(
          (c): c is ConfigAgentUIV1.WhatsAppChannelBinding =>
            c.type === "whatsapp" && ConfigAgentUIV1.isNativeWhatsAppChannel(c),
        )
        if (!channel) {
          debug(
            `[WhatsApp Native Reconcile] sem canal nativo: ${agent.id} channels=${JSON.stringify(agent.channels.map((c) => ("type" in c ? c.type : "?")))}`,
          )
          continue
        }

        expected.add(agent.id)

        const currentSession = manager.getSession(agent.id)
        if (currentSession?.state === "connected" || currentSession?.state === "connecting") continue

        // Se tem credenciais salvas no banco SQLite (auth.load), reconecta automaticamente sem pedir QR
        if (store) {
          const sessionStore = store.session(agent.id)
          const creds = yield* Effect.tryPromise(() => sessionStore.auth.load()).pipe(
            Effect.catch(() => Effect.succeed(undefined)),
          )
          if (creds && creds.meJid) {
            debug(
              `[WhatsApp Native Reconcile] reconectando ${agent.id} (${creds.meJid}) mode=${ConfigAgentUIV1.whatsappMode(channel)} provider=${channel.provider ?? "-"}`,
            )
            // catchCause (não catch): uma config/estado inesperado de UM agente
            // não pode matar o supervisor nem derrubar o processo.
            yield* manager.connect(agent.id, channel as ConfigAgentUIV1.WhatsAppChannelBinding, agentUI).pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning("Falha na auto-reconexão do WhatsApp nativo", {
                  agentId: agent.id,
                  error: String(cause),
                }),
              ),
            )
          }
        }
      }

      for (const session of manager.listSessions()) {
        if (expected.has(session.agentId)) continue
        yield* manager.disconnect(session.agentId).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("Falha ao encerrar sessão nativa órfã", {
              agentId: session.agentId,
              error: String(cause),
            }),
          ),
        )
      }
    })

    // Roda o supervisor em background a cada 5 segundos (mesmo padrão do
    // Telegram). Um único supervisor por processo, mesmo quando o serviço é
    // construído em mais de um grafo (rotas + ToolRegistry).
    if (!supervisorStarted) {
      supervisorStarted = true
      yield* Effect.forkScoped(
        reconcileAgents.pipe(
          Effect.catchCause((cause) => Effect.logError("WhatsApp native reconcile failed", { cause })),
          Effect.andThen(() => Effect.sleep("5 seconds")),
          Effect.forever,
        ),
      )
    }

    return Service.of({
      getStatus,
      connect,
      logout,
      subscribeEvents,
      sendText: sendTextOp,
      sendMedia: sendMediaOp,
      sendReaction: sendReactionOp,
      sendButtons,
      sendLinkButton,
      sendList,
      sendPix,
      sendCarousel,
      readMessages: readMessagesOp,
      listChats,
      listGroups,
      groupInfo,
      listGroupParticipants,
      groupCreate,
      groupUpdateParticipants,
      groupInvite,
    })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [],
})
