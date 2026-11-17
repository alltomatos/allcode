import { Cause, Effect, Option } from "effect"
import { Schedule } from "@allcode/core/schedule"

// O manager do WhatsApp roda em um contexto que nem sempre expõe o
// Schedule.Service (o grafo do sidecar é diferente do grafo das rotas).
// O restart-bridge registra a instância assim que o servidor sobe.
let registered: Schedule.Interface | undefined

export function setReminderScheduler(service: Schedule.Interface): void {
  registered = service
}

/**
 * Scheduler registrado pelo bridge de restart. Usado por outras ações de
 * WhatsApp (ex.: reuniões) que também rodam fora do grafo do Schedule.
 */
export function registeredScheduler(): Schedule.Interface | undefined {
  return registered
}

/**
 * Ações disparadas pelos botões de lembrete no WhatsApp
 * (`reminder:done:<id>`, `reminder:snooze:<id>:<min>`, `reminder:cancel:<id>`).
 * Retorna sempre um texto de resposta — falhas viram mensagem para o usuário,
 * nunca derrubam o processamento do inbound.
 */
export function runReminderAction(id: string): Effect.Effect<string> {
  return Effect.gen(function* () {
    const [, verb, scheduleId, minutesRaw] = id.split(":")
    if (!scheduleId) return "Não entendi a ação do lembrete (id incompleto)."

    const schedules = Option.getOrUndefined(yield* Effect.serviceOption(Schedule.Service)) ?? registered
    if (!schedules) return "A agenda não está disponível neste processo."

    const scheduleID = Schedule.ID.make(scheduleId)
    const found = yield* schedules.get(scheduleID)
    if (!found) return "Lembrete não encontrado (talvez já tenha sido concluído ou cancelado)."

    if (verb === "done") {
      yield* schedules.update(scheduleID, {
        name: found.name,
        description: found.description,
        trigger: found.trigger,
        action: found.action,
        workspace: found.workspace,
        enabled: false,
      })
      return "✅ Lembrete concluído."
    }

    if (verb === "snooze") {
      const minutes = Math.max(1, Number(minutesRaw) || 10)
      yield* schedules.update(scheduleID, {
        name: found.name,
        description: found.description,
        trigger: { kind: "once", timestamp: Date.now() + minutes * 60_000 },
        action: found.action,
        workspace: found.workspace,
        enabled: true,
      })
      return `⏰ Lembrete adiado por ${minutes} minutos.`
    }

    if (verb === "cancel") {
      yield* schedules.remove(scheduleID)
      return "🗑️ Lembrete cancelado."
    }

    return "Ação de lembrete desconhecida."
  }).pipe(
    Effect.catchCause((cause) => {
      const error = Cause.squash(cause)
      return Effect.succeed(
        `Não foi possível processar o lembrete: ${error instanceof Error ? error.message : String(error)}`,
      )
    }),
  )
}

export * as WhatsAppReminderActions from "./reminder-actions"
