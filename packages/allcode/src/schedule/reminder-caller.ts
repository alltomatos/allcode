export * as ScheduleReminderCaller from "./reminder-caller"

import { Cause, Effect, Exit, Layer } from "effect"
import { makeGlobalNode } from "@allcode/core/effect/app-node"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { Schedule } from "@allcode/core/schedule"
import { AgentUI } from "@/agentui"
import { ConfigAgentUIV1 } from "@allcode/core/v1/config/agentui"
import { WhatsAppNative } from "@/whatsapp-native"
import { agentForSession, chatForSession } from "@/whatsapp-native/bindings"
import { buildExternalAdapter } from "@/whatsapp/adapter"
import { createConnector } from "waconector"

/** Payload dos botões interativos; os ids casam com reminder-actions.ts. */
export function reminderButtons(reminderId: string) {
  return [
    { id: `reminder:done:${reminderId}`, text: "Concluir" },
    { id: `reminder:snooze:${reminderId}:10`, text: "Adiar 10 min" },
    { id: `reminder:cancel:${reminderId}`, text: "Cancelar" },
  ]
}

interface DeliveryResult {
  readonly ok: boolean
  readonly error?: string
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Entrega de lembretes: desktop e WhatsApp.
 *
 * WhatsApp nativo (zapo) usa sempre a conexão do próprio agente AgentUI —
 * mensagens interativas quando há `reminderId`, com fallback para texto.
 * Não há dependência de MCP: a ferramenta nativa cobre o envio. Canais
 * `external` continuam usando o adapter/waconector do próprio canal.
 */
export const layer = Layer.effect(
  ScheduleRunner.ReminderCaller,
  Effect.gen(function* () {
    const agentUI = yield* AgentUI.Service
    const whatsappNative = yield* WhatsAppNative.Service

    return ScheduleRunner.ReminderCaller.of({
      notifyReminder: (action: Schedule.ReminderAction, workspace: string | undefined) =>
        Effect.gen(function* () {
          const channels = action.channels && action.channels.length > 0 ? action.channels : ["desktop"]
          yield* Effect.logInfo(`[Reminder] Disparando lembrete: "${action.title}" para canais: ${channels.join(", ")}`)

          let whatsappSuccess = false
          let whatsappError: string | undefined

          if (channels.includes("whatsapp")) {
            const formattedMessage = `🔔 *Lembrete: ${action.title}*\n\n${action.message}`

            const sendNative = (agentId: string, to: string): Effect.Effect<DeliveryResult> =>
              Effect.gen(function* () {
                const errors: string[] = []

                if (action.reminderId) {
                  const buttons = yield* whatsappNative
                    .sendButtons({
                      agentId,
                      to,
                      title: "Lembrete",
                      body: formattedMessage,
                      footer: "Use os botões para concluir, adiar ou cancelar.",
                      buttons: reminderButtons(action.reminderId),
                    })
                    .pipe(Effect.exit)
                  if (Exit.isSuccess(buttons)) return { ok: true }
                  errors.push(`botões: ${errorText(Cause.squash(buttons.cause))}`)
                }

                const text = yield* whatsappNative
                  .sendText({ agentId, to, text: formattedMessage })
                  .pipe(Effect.exit)
                if (Exit.isSuccess(text)) return { ok: true }
                errors.push(`texto: ${errorText(Cause.squash(text.cause))}`)

                return { ok: false, error: errors.join("; ") }
              }).pipe(
                Effect.tap((result) =>
                  result.ok
                    ? Effect.logInfo(`[Reminder] WhatsApp nativo enviado (${agentId}) para ${to}`)
                    : Effect.logWarning(
                        `[Reminder] Falha no WhatsApp nativo (${agentId}) para ${to}: ${result.error ?? "erro desconhecido"}`,
                      ),
                ),
                Effect.catchCause((cause) =>
                  Effect.succeed({ ok: false, error: errorText(Cause.squash(cause)) }),
                ),
              )

            // Destino principal: a conversa que originou o lembrete.
            const targetSessionId = action.targetSessionId
            const sessionAgent = action.agentId ?? (targetSessionId ? agentForSession(targetSessionId) : undefined)
            const sessionChat = action.targetChat ?? (targetSessionId ? chatForSession(targetSessionId) : undefined)

            const targets: Array<{ agentId: string; to: string }> = []
            if (sessionAgent && sessionChat) targets.push({ agentId: sessionAgent, to: sessionChat })

            // Lembretes criados fora de uma conversa (aba Agenda): usa os
            // remetentes autorizados dos agentes com canal nativo.
            if (targets.length === 0) {
              const agents = yield* agentUI.list().pipe(Effect.catchCause(() => Effect.succeed([])))
              for (const agent of agents) {
                const waChannel = agent.channels?.find((c) => c.type === "whatsapp")
                if (!waChannel || !ConfigAgentUIV1.isNativeWhatsAppChannel(waChannel)) continue
                for (const to of waChannel.allowedSenders ?? []) targets.push({ agentId: agent.id, to })
              }
            }

            if (targets.length === 0) {
              whatsappError = "Lembrete sem conversa de destino conhecida para entrega no WhatsApp."
            }

            for (const target of targets) {
              const result = yield* sendNative(target.agentId, target.to)
              if (result.ok) {
                whatsappSuccess = true
                break
              }
              whatsappError = result.error ?? whatsappError
            }

            // Canais externos (izapia/waha) continuam suportados pelo próprio
            // adapter do canal — sem passar por MCP.
            if (!whatsappSuccess) {
              const agents = yield* agentUI.list().pipe(Effect.catchCause(() => Effect.succeed([])))
              for (const agent of agents) {
                const waChannel = agent.channels?.find((c) => c.type === "whatsapp")
                if (!waChannel || ConfigAgentUIV1.isNativeWhatsAppChannel(waChannel)) continue

                const adapter = buildExternalAdapter(waChannel, waChannel.sessionIds?.[0])
                if (!adapter) continue

                const connector = createConnector(adapter)
                for (const target of waChannel.allowedSenders ?? []) {
                  const exit = yield* Effect.tryPromise(() =>
                    connector.messages.sendText({ to: target, text: formattedMessage }),
                  ).pipe(Effect.exit)
                  if (Exit.isSuccess(exit)) {
                    whatsappSuccess = true
                    yield* Effect.logInfo(
                      `[Reminder] WhatsApp enviado via canal externo (${agent.name ?? agent.id}) para ${target}`,
                    )
                    continue
                  }
                  whatsappError = errorText(Cause.squash(exit.cause))
                  yield* Effect.logWarning(
                    `[Reminder] Falha no canal externo (${agent.name ?? agent.id}) para ${target}: ${whatsappError}`,
                  )
                }
              }
            }
          }

          if (channels.includes("desktop")) {
            console.log(`[REMINDER DESKTOP] 🔔 ${action.title}: ${action.message}`)
          }

          if (channels.includes("whatsapp") && !whatsappSuccess) {
            return {
              success: false,
              error: whatsappError ?? "Nenhuma sessão/canal de WhatsApp disponível para enviar o lembrete.",
            }
          }

          return { success: true }
        }).pipe(
          Effect.catchCause((cause) => {
            const err = Cause.squash(cause)
            return Effect.succeed({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            })
          }),
        ),
    })
  }),
)

export const node = makeGlobalNode({
  service: ScheduleRunner.ReminderCaller,
  layer,
  deps: [AgentUI.node, WhatsAppNative.node],
})
