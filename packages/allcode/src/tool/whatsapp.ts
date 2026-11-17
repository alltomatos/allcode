import { Effect, Schema } from "effect"
import { Schedule } from "@allcode/core/schedule"
import * as Tool from "./tool"
import DESCRIPTION from "./whatsapp.txt"
import { WhatsAppNative } from "@/whatsapp-native"
import { agentForSession, chatForSession } from "@/whatsapp-native/bindings"
import { deliveryJid, isWhatsAppJid } from "@/whatsapp-native/contacts"
import { meetingButtons, parseMeetingDate, type MeetingMetadata } from "@/whatsapp-native/meetings"

const QuickReply = Schema.Struct({
  id: Schema.String.annotate({ description: "Identificador devolvido quando o botão é tocado." }),
  text: Schema.String.annotate({ description: "Texto exibido no botão (curto, ~20 caracteres)." }),
})

const ListRow = Schema.Struct({
  id: Schema.String.annotate({ description: "Identificador da linha escolhida." }),
  title: Schema.String,
  description: Schema.optional(Schema.String),
})

const ListSection = Schema.Struct({
  title: Schema.optional(Schema.String),
  rows: Schema.Array(ListRow),
})

const CarouselCard = Schema.Struct({
  body: Schema.String.annotate({ description: "Texto do card (obrigat�rio)." }),
  title: Schema.optional(Schema.String),
  footer: Schema.optional(Schema.String),
  media: Schema.String.annotate({
    description:
      "URL http(s) ou caminho local de uma IMAGEM (png/jpeg/webp). Obrigat�rio: o WhatsApp n�o renderiza carrossel sem m�dia no card.",
  }),
  mimetype: Schema.optional(Schema.String).annotate({
    description: "Mimetype da imagem do card (padr�o: inferido pela extens�o).",
  }),
  buttons: Schema.Array(QuickReply),
})

const Actions = [
  "status",
  "send_text",
  "send_media",
  "send_reaction",
  "send_buttons",
  "send_link",
  "send_list",
  "send_pix",
  "send_carousel",
  "read_messages",
  "list_chats",
  "list_contacts",
  "request_meeting",
  "list_groups",
  "group_info",
  "group_create",
  "group_update_participants",
  "group_invite",
] as const

export const Parameters = Schema.Struct({
  action: Schema.Literals(Actions).annotate({
    description: "Ação a executar no WhatsApp nativo.",
  }),
  agentId: Schema.optional(Schema.String).annotate({
    description: "ID do agente no AgentUI (padrão: o agente em execução).",
  }),
  to: Schema.optional(Schema.String).annotate({
    description: "Destinatário: número com DDI/DDD ou JID de grupo (…@g.us).",
  }),
  text: Schema.optional(Schema.String).annotate({ description: "Texto da mensagem." }),
  quoteId: Schema.optional(Schema.String).annotate({
    description: "ID da mensagem que está sendo respondida (quote).",
  }),
  quoteParticipant: Schema.optional(Schema.String).annotate({
    description: "Autor da mensagem citada (obrigatório em grupos quando a mensagem é de outra pessoa).",
  }),
  chatId: Schema.optional(Schema.String).annotate({
    description: "Conversa alvo em ações que não enviam mensagem (read_messages).",
  }),
  messageId: Schema.optional(Schema.String).annotate({
    description: "ID da mensagem alvo em send_reaction.",
  }),
  fromMe: Schema.optional(Schema.Boolean).annotate({
    description: "Em send_reaction: a mensagem alvo foi enviada por você? (padrão: false)",
  }),
  emoji: Schema.optional(Schema.String).annotate({
    description: "Emoji da reação. String vazia remove a reação.",
  }),
  media: Schema.optional(Schema.String).annotate({
    description: "Caminho local ou URL do arquivo em send_media.",
  }),
  mediaKind: Schema.optional(Schema.Literals(["image", "video", "audio", "document", "sticker"])).annotate({
    description: "Tipo da mídia (padrão: inferido pela extensão).",
  }),
  caption: Schema.optional(Schema.String).annotate({ description: "Legenda da mídia." }),
  mimetype: Schema.optional(Schema.String).annotate({
    description: "Mimetype explícito da mídia (ex.: image/png).",
  }),
  filename: Schema.optional(Schema.String).annotate({
    description: "Nome exibido para documentos.",
  }),
  title: Schema.optional(Schema.String).annotate({ description: "Título/cabeçalho da mensagem interativa." }),
  footer: Schema.optional(Schema.String).annotate({ description: "Rodapé da mensagem interativa." }),
  buttons: Schema.optional(Schema.Array(QuickReply)).annotate({
    description: "Botões de resposta rápida (até 3).",
  }),
  label: Schema.optional(Schema.String).annotate({ description: "Texto do botão de link em send_link." }),
  url: Schema.optional(Schema.String).annotate({ description: "URL aberta pelo botão de link." }),
  buttonText: Schema.optional(Schema.String).annotate({
    description: "Texto do botão que abre a lista em send_list.",
  }),
  sections: Schema.optional(Schema.Array(ListSection)).annotate({
    description: "Seções da lista (até 10 seções, 10 linhas cada).",
  }),
  pixKey: Schema.optional(Schema.String).annotate({ description: "Chave PIX da cobrança." }),
  pixKeyType: Schema.optional(Schema.Literals(["EVP", "PHONE", "EMAIL", "CPF", "CNPJ"])).annotate({
    description: "Tipo da chave PIX (padrão: EVP, chave aleatória).",
  }),
  merchantName: Schema.optional(Schema.String).annotate({
    description: "Nome do recebedor exibido na cobrança PIX.",
  }),
  amountCents: Schema.optional(Schema.Number).annotate({
    description: "Valor em centavos. Ausente = o pagador informa o valor.",
  }),
  referenceId: Schema.optional(Schema.String).annotate({
    description: "Identificador da cobrança PIX (padrão: gerado automaticamente).",
  }),
  cards: Schema.optional(Schema.Array(CarouselCard)).annotate({
    description: "Cartões do carrossel (experimental, até 10).",
  }),
  limit: Schema.optional(Schema.Number).annotate({
    description: "Limite de itens em list_chats/list_contacts/read_messages/list_groups.",
  }),
  query: Schema.optional(Schema.String).annotate({
    description: "Em list_contacts: filtra a agenda por nome, usuário ou telefone.",
  }),
  contact: Schema.optional(Schema.String).annotate({
    description:
      "Em request_meeting: nome do contato salvo na agenda do WhatsApp ou o telefone completo (DDI/DDD). O número precisa estar salvo na agenda ou ser um telefone válido.",
  }),
  targetDate: Schema.optional(Schema.String).annotate({
    description:
      "Em request_meeting: data/hora da reunião em ISO-8601 ou 'YYYY-MM-DD HH:mm'. Ausente = horário a combinar.",
  }),
  beforeTimestampMs: Schema.optional(Schema.Number).annotate({
    description: "Em read_messages: retorna mensagens anteriores a este timestamp (ms).",
  }),
  onlyAdmin: Schema.optional(Schema.Boolean).annotate({
    description: "Em list_groups: retorna apenas grupos onde o número é administrador.",
  }),
  groupId: Schema.optional(Schema.String).annotate({ description: "JID do grupo (…@g.us)." }),
  subject: Schema.optional(Schema.String).annotate({ description: "Nome do grupo em group_create." }),
  participants: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Participantes (números/JIDs) em group_create e group_update_participants.",
  }),
  participantAction: Schema.optional(Schema.Literals(["add", "remove", "promote", "demote"])).annotate({
    description: "Operação de group_update_participants.",
  }),
  revoke: Schema.optional(Schema.Boolean).annotate({
    description: "Em group_invite: revoga o link atual em vez de retorná-lo.",
  }),
})

type Params = Schema.Schema.Type<typeof Parameters>

export const WhatsAppTool = Tool.define(
  "whatsapp",
  Effect.gen(function* () {
    const native = yield* WhatsAppNative.Service
    const schedules = yield* Schedule.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Params, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "whatsapp",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          const agentId = params.agentId || agentForSession(ctx.sessionID)
          // Em sessão de canal o destino é sempre a conversa atual; `to` só é
          // usado quando a sessão não está presa a um chat. Evita que o modelo
          // invente um JID e mande a mensagem/mídia para o chat errado. O
          // sandbox usa o chatKey "sandbox", que não é JID: nesse caso `to`
          // continua valendo.
          const sessionChat = chatForSession(ctx.sessionID)
          const boundChat = isWhatsAppJid(sessionChat) ? sessionChat : undefined
          const target = boundChat || params.to?.trim()
          const quote =
            params.quoteId && params.quoteId.trim()
              ? {
                  id: params.quoteId,
                  participant: params.quoteParticipant,
                  remoteJid: target ?? params.chatId,
                }
              : undefined

          if (!agentId) {
            return {
              title: "WhatsApp",
              output:
                "Erro: n�o consegui identificar o agente do AgentUI desta sess�o. Informe agentId explicitamente.",
              metadata: {},
            }
          }

          const done = (title: string, output: unknown) => ({
            title,
            output: typeof output === "string" ? output : JSON.stringify(output, null, 2),
            metadata: {},
          })
          const missing = (field: string) =>
            done("Parâmetro ausente", `Erro: '${field}' é obrigatório para a ação '${params.action}'.`)

          switch (params.action) {
            case "status":
              return done("Status WhatsApp", yield* native.getStatus(agentId))

            case "send_text":
              if (!target || !params.text) return missing("to/text")
              return done(
                "Mensagem WhatsApp",
                yield* native
                  .sendText({ agentId, to: target, text: params.text, quote })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "send_media":
              if (!target || !params.media) return missing("to/media")
              return done(
                "Mídia WhatsApp",
                yield* native
                  .sendMedia({
                    agentId,
                    to: target,
                    media: params.media,
                    kind: params.mediaKind,
                    caption: params.caption,
                    mimetype: params.mimetype,
                    filename: params.filename,
                    quote,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "send_reaction":
              if (!params.chatId || !params.messageId || params.emoji === undefined) {
                return missing("chatId/messageId/emoji")
              }
              return done(
                "Reação WhatsApp",
                yield* native
                  .sendReaction({
                    agentId,
                    chatId: params.chatId,
                    messageId: params.messageId,
                    emoji: params.emoji,
                    fromMe: params.fromMe,
                    participant: params.quoteParticipant,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "send_buttons":
              if (!target || !params.text || !params.buttons?.length) return missing("to/text/buttons")
              return done(
                "Botões WhatsApp",
                yield* native
                  .sendButtons({
                    agentId,
                    to: target,
                    body: params.text,
                    title: params.title,
                    footer: params.footer,
                    buttons: params.buttons,
                    quote,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "send_link":
              if (!target || !params.text || !params.label || !params.url) {
                return missing("to/text/label/url")
              }
              return done(
                "Botão de link WhatsApp",
                yield* native
                  .sendLinkButton({
                    agentId,
                    to: target,
                    body: params.text,
                    label: params.label,
                    url: params.url,
                    title: params.title,
                    footer: params.footer,
                    quote,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "send_list":
              if (!target || !params.text || !params.buttonText || !params.sections?.length) {
                return missing("to/text/buttonText/sections")
              }
              return done(
                "Lista WhatsApp",
                yield* native
                  .sendList({
                    agentId,
                    to: target,
                    body: params.text,
                    buttonText: params.buttonText,
                    title: params.title,
                    footer: params.footer,
                    sections: params.sections,
                    quote,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "send_pix":
              if (!target || !params.text || !params.pixKey) return missing("to/text/pixKey")
              return done(
                "Cobrança PIX",
                yield* native
                  .sendPix({
                    agentId,
                    to: target,
                    body: params.text,
                    key: params.pixKey,
                    keyType: params.pixKeyType,
                    merchantName: params.merchantName,
                    amountCents: params.amountCents,
                    referenceId: params.referenceId,
                    title: params.title,
                    footer: params.footer,
                    quote,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "send_carousel":
              if (!target || !params.cards?.length) return missing("to/cards")
              return done(
                "Carrossel WhatsApp",
                yield* native
                  .sendCarousel({ agentId, to: target, body: params.text, cards: params.cards, quote })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "read_messages":
              if (!params.chatId) return missing("chatId")
              return done(
                "Mensagens",
                yield* native
                  .readMessages({
                    agentId,
                    chatId: params.chatId,
                    limit: params.limit,
                    beforeTimestampMs: params.beforeTimestampMs,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "list_chats":
              return done(
                "Conversas WhatsApp",
                yield* native
                  .listChats({ agentId, limit: params.limit })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "list_contacts":
              return done(
                "Contatos salvos no WhatsApp",
                yield* native
                  .listContacts({ agentId, query: params.query ?? params.contact, limit: params.limit ?? 50 })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "request_meeting": {
              if (!params.contact || !params.text) return missing("contact/text")

              const raw = params.contact.trim()
              const digits = raw.replace(/\D/g, "")
              const looksLikePhone = digits.length >= 10 && digits.length <= 15 && /^\+?[\d\s()\-]+$/.test(raw)

              let to: string
              let contactName: string | undefined

              if (looksLikePhone) {
                const matches = yield* native
                  .listContacts({ agentId, query: digits, limit: 5 })
                  .pipe(Effect.catch(() => Effect.succeed([])))
                const exact = matches.find((match) => (match.phone ?? "").replace(/\D/g, "") === digits)
                to = exact ? deliveryJid(exact) : `${digits}@s.whatsapp.net`
                contactName = exact?.name
              } else {
                const matches = yield* native
                  .listContacts({ agentId, query: raw, limit: 10 })
                  .pipe(Effect.catch(() => Effect.succeed([])))
                if (matches.length === 0) {
                  return done(
                    "Contato não encontrado",
                    `Não encontrei "${raw}" na agenda do WhatsApp. Use list_contacts para ver os contatos salvos ou informe o número completo com DDI/DDD.`,
                  )
                }
                if (matches.length > 1) {
                  return done(
                    "Vários contatos encontrados",
                    `${JSON.stringify(matches.map((match) => ({ nome: match.name, telefone: match.phone })), null, 2)}\n\nInforme o telefone exato para eu enviar o convite.`,
                  )
                }
                to = deliveryJid(matches[0])
                contactName = matches[0].name
              }

              let targetTimestamp: number | undefined
              if (params.targetDate) {
                targetTimestamp = parseMeetingDate(params.targetDate)
                if (!targetTimestamp) {
                  return done(
                    "Data inválida",
                    `Não consegui interpretar "${params.targetDate}". Use ISO-8601 (ex.: 2026-11-12T15:00:00-03:00) ou 'YYYY-MM-DD HH:mm'.`,
                  )
                }
                if (targetTimestamp <= Date.now()) {
                  return done(
                    "Data no passado",
                    `A data informada (${new Date(targetTimestamp).toISOString()}) já passou. Informe uma data futura.`,
                  )
                }
              }

              const meetingTitle = params.title?.trim() || `Reunião com ${contactName ?? to}`
              const meeting: MeetingMetadata = {
                contactJid: to,
                contactName,
                title: meetingTitle,
                status: "pending",
                requesterChat: boundChat,
                requesterAgentId: agentId,
              }
              const baseAction: Schedule.ReminderAction = {
                kind: "reminder",
                title: meetingTitle,
                message: params.text,
                channels: boundChat ? ["desktop", "whatsapp"] : ["desktop"],
                targetSessionId: ctx.sessionID,
                targetChat: boundChat,
                agentId,
              }
              const created = yield* schedules
                .create({
                  name: `Reunião: ${meetingTitle}`,
                  description: params.text,
                  trigger: targetTimestamp ? { kind: "once", timestamp: targetTimestamp } : { kind: "manual" },
                  action: baseAction,
                  enabled: Boolean(targetTimestamp),
                  metadata: { meeting },
                })
                .pipe(Effect.catch(() => Effect.succeed(undefined)))
              if (!created) {
                return done("Falha ao registrar reunião", "Não consegui registrar a reunião na agenda.")
              }

              yield* schedules
                .update(created.id, {
                  name: created.name,
                  description: created.description,
                  trigger: created.trigger,
                  action: { ...baseAction, reminderId: created.id },
                  workspace: created.workspace,
                  enabled: created.enabled,
                  metadata: created.metadata,
                })
                .pipe(Effect.catch(() => Effect.succeed(undefined)))

              const sent = yield* native
                .sendButtons({
                  agentId,
                  to,
                  title: "Confirmação de reunião",
                  body: params.text,
                  footer: "Toque em um botão para responder.",
                  buttons: meetingButtons(created.id),
                })
                .pipe(Effect.catch((err) => Effect.succeed({ error: err.message })))

              if ("error" in sent) {
                yield* schedules.remove(created.id).pipe(Effect.catchCause(() => Effect.void))
                return done(
                  "Falha ao enviar convite",
                  `Não consegui enviar o convite para ${contactName ?? to}: ${sent.error}`,
                )
              }

              return done("Convite de reunião enviado", {
                contato: contactName ?? to,
                para: to,
                reuniao: meetingTitle,
                quando: targetTimestamp ? new Date(targetTimestamp).toISOString() : "a combinar",
                status: "aguardando confirmação",
                registroAgenda: created.id,
              })
            }

            case "list_groups":
              return done(
                params.onlyAdmin ? "Grupos administrados" : "Grupos WhatsApp",
                yield* native
                  .listGroups({ agentId, onlyAdmin: params.onlyAdmin })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "group_info":
              if (!params.groupId) return missing("groupId")
              return done(
                "Dados do grupo",
                yield* native
                  .groupInfo({ agentId, groupId: params.groupId })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "group_create":
              if (!params.subject || !params.participants?.length) return missing("subject/participants")
              return done(
                "Grupo criado",
                yield* native
                  .groupCreate({ agentId, subject: params.subject, participants: params.participants })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "group_update_participants":
              if (!params.groupId || !params.participantAction || !params.participants?.length) {
                return missing("groupId/participantAction/participants")
              }
              return done(
                "Participantes atualizados",
                yield* native
                  .groupUpdateParticipants({
                    agentId,
                    groupId: params.groupId,
                    action: params.participantAction,
                    participants: params.participants,
                  })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )

            case "group_invite":
              if (!params.groupId) return missing("groupId")
              return done(
                "Link de convite",
                yield* native
                  .groupInvite({ agentId, groupId: params.groupId, revoke: params.revoke })
                  .pipe(Effect.catch((err) => Effect.succeed({ error: err.message }))),
              )
          }
        }),
    }
  }),
)
