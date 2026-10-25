export * as ScheduleReminderCaller from "./reminder-caller"

import { Effect, Layer } from "effect"
import { makeGlobalNode } from "@allcode/core/effect/app-node"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { Schedule } from "@allcode/core/schedule"
import { AgentUI } from "@/agentui"
import { MCP } from "@/mcp"
import { buildExternalAdapter } from "@/whatsapp/adapter"
import { createConnector } from "waconector"

/**
 * Wires the Schedule engine's reminder action to real delivery channels
 * (Desktop notifications, WhatsApp via Izapia/waconector, and MCP izapia).
 */
export const layer = Layer.effect(
  ScheduleRunner.ReminderCaller,
  Effect.gen(function* () {
    const agentUI = yield* AgentUI.Service
    const mcp = yield* MCP.Service

    return ScheduleRunner.ReminderCaller.of({
      notifyReminder: (action: Schedule.ReminderAction, workspace: string | undefined) =>
        Effect.gen(function* () {
          const channels = action.channels && action.channels.length > 0 ? action.channels : ["desktop"]
          yield* Effect.logInfo(`[Reminder] Disparando lembrete: "${action.title}" para canais: ${channels.join(", ")}`)

          let whatsappSuccess = false
          let whatsappError: string | undefined

          if (channels.includes("whatsapp")) {
            const formattedMessage = `🔔 *Lembrete: ${action.title}*\n\n${action.message}`

            // 1. Tentar despachar usando os canais WhatsApp configurados nos agentes AgentUI
            const agents = yield* agentUI.list().pipe(Effect.orElseSucceed(() => []))
            for (const agent of agents) {
              const waChannel = agent.channels?.find((c) => c.type === "whatsapp")
              if (!waChannel) continue

              // Se houver destinatários permitidos ou configurados
              const targets = waChannel.allowedSenders && waChannel.allowedSenders.length > 0
                ? waChannel.allowedSenders
                : []

              const sid = waChannel.sessionIds?.[0]
              // Canais nativos são servidos por WhatsAppNative (sem waconector):
              // não há adapter externo para eles, então pulamos em vez de falhar.
              const adapter = buildExternalAdapter(waChannel, sid)
              if (!adapter) continue
              const connector = createConnector(adapter)

              for (const target of targets) {
                const res = yield* Effect.tryPromise(() =>
                  connector.messages.sendText({ to: target, text: formattedMessage }),
                ).pipe(
                  Effect.tap(() =>
                    Effect.logInfo(`[Reminder] WhatsApp enviado com sucesso via AgentUI (${agent.name ?? agent.id}) para ${target}`),
                  ),
                  Effect.tapError((err: unknown) =>
                    Effect.logWarning(`[Reminder] Falha ao enviar WhatsApp via AgentUI para ${target}: ${String(err)}`),
                  ),
                  Effect.option,
                )
                if (res._tag === "Some") {
                  whatsappSuccess = true
                }
              }
            }

            // 2. Se não conseguiu via AgentUI, tentar usar a conexão MCP izapia se disponível
            if (!whatsappSuccess) {
              const statuses: Record<string, { status: string }> = yield* mcp
                .status()
                .pipe(Effect.orElseSucceed(() => ({} as Record<string, { status: string }>)))

              if (statuses["izapia"]?.status === "connected") {
                const catalog = yield* mcp
                  .serverCatalog("izapia")
                  .pipe(Effect.orElseSucceed(() => ({ tools: [], prompts: [], resources: [] })))

                const hasSendText = catalog.tools.some((t) => t.name === "izapia_send_text")
                if (hasSendText) {
                  // Descobrir sessões disponíveis no MCP izapia
                  const listSessionsRaw = yield* mcp.callTool("izapia", "izapia_list_sessions", {}).pipe(
                    Effect.orElseSucceed(() => undefined),
                  )
                  let sid = "alltomatobr"
                  if (listSessionsRaw && !listSessionsRaw.isError && Array.isArray((listSessionsRaw as any).content)) {
                    const text = (listSessionsRaw as any).content.map((c: any) => c.text).join("")
                    try {
                      const parsed = JSON.parse(text)
                      const firstSession = Array.isArray(parsed) ? parsed[0]?.name || parsed[0]?.id : undefined
                      if (firstSession) sid = firstSession
                    } catch {
                      // mantém default
                    }
                  }

                  // Buscar contatos ou enviar para o número padrão 8598490991
                  const mcpSend = yield* mcp.callTool("izapia", "izapia_send_text", {
                    session: sid,
                    to: "8598490991",
                    text: formattedMessage,
                  }).pipe(
                    Effect.orElseSucceed(() => ({ isError: true } as any)),
                  )

                  if (mcpSend && !mcpSend.isError) {
                    whatsappSuccess = true
                    yield* Effect.logInfo(`[Reminder] WhatsApp enviado com sucesso via MCP izapia para 8598490991`)
                  } else {
                    whatsappError = "Falha no envio pelo MCP izapia"
                  }
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
          Effect.catch((err: unknown) =>
            Effect.succeed({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          ),
        ),
    })
  }),
)

export const node = makeGlobalNode({
  service: ScheduleRunner.ReminderCaller,
  layer,
  deps: [AgentUI.node, MCP.node],
})

