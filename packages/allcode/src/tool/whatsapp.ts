import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./whatsapp.txt"
import { WhatsAppNative } from "@/whatsapp-native"

export const Parameters = Schema.Struct({
  action: Schema.Literals(["status", "send_text", "list_chats", "list_groups"]).annotate({
    description: "Ação a ser executada no WhatsApp: 'status', 'send_text', 'list_chats' ou 'list_groups'.",
  }),
  agentId: Schema.optional(Schema.String).annotate({
    description: "ID do agente no AgentUI (opcional, defaults para o agente ativo).",
  }),
  to: Schema.optional(Schema.String).annotate({
    description: "Destinatário (número de telefone com DDI/DDD ou JID) para 'send_text'.",
  }),
  text: Schema.optional(Schema.String).annotate({
    description: "Texto da mensagem a ser enviada para 'send_text'.",
  }),
  limit: Schema.optional(Schema.Number).annotate({
    description: "Limite de conversas a retornar para 'list_chats' (padrão: 20).",
  }),
  onlyAdmin: Schema.optional(Schema.Boolean).annotate({
    description: "Para 'list_groups': filtrar e retornar apenas grupos onde o número/agente é administrador.",
  }),
})

export const WhatsAppTool = Tool.define(
  "whatsapp",
  Effect.gen(function* () {
    const native = yield* WhatsAppNative.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "whatsapp",
            patterns: ["*"],
            always: ["*"],
            metadata: {},
          })

          const agentId = params.agentId || "default"

          switch (params.action) {
            case "status": {
              const status = yield* native.getStatus(agentId)
              return {
                title: "Status WhatsApp",
                output: JSON.stringify(status, null, 2),
                metadata: {},
              }
            }
            case "send_text": {
              if (!params.to || !params.text) {
                return {
                  title: "Envio de Mensagem",
                  output: "Erro: 'to' e 'text' são obrigatórios para a ação 'send_text'.",
                  metadata: {},
                }
              }
              const res = yield* native.sendText({
                agentId,
                to: params.to,
                text: params.text,
              }).pipe(
                Effect.catch((err) =>
                  Effect.succeed({ error: err.message }),
                ),
              )
              return {
                title: "Mensagem WhatsApp",
                output: JSON.stringify(res, null, 2),
                metadata: {},
              }
            }
            case "list_chats": {
              const chats = yield* native.listChats({
                agentId,
                limit: params.limit,
              }).pipe(
                Effect.catch((err) =>
                  Effect.succeed({ error: err.message, chats: [] }),
                ),
              )
              return {
                title: "Conversas WhatsApp",
                output: JSON.stringify(chats, null, 2),
                metadata: {},
              }
            }
            case "list_groups": {
              const groups = yield* native.listGroups({
                agentId,
                onlyAdmin: params.onlyAdmin,
              }).pipe(
                Effect.catch((err) =>
                  Effect.succeed({ error: err.message, groups: [] }),
                ),
              )
              return {
                title: params.onlyAdmin ? "Grupos Administrados" : "Grupos WhatsApp",
                output: JSON.stringify(groups, null, 2),
                metadata: {},
              }
            }
          }
        }),
    }
  }),
)
