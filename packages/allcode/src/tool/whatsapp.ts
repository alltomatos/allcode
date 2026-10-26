import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./whatsapp.txt"
import { WhatsAppNative } from "@/whatsapp-native"
import { agentForSession, chatForSession } from "@/whatsapp-native/bindings"

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
    description: "Limite de itens em list_chats/read_messages/list_groups.",
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
          // invente um JID e mande a mensagem/mídia para o chat errado.
          const target = chatForSession(ctx.sessionID) || params.to?.trim()
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
