import { Cause, Effect, Option } from "effect"
import { Schedule } from "@allcode/core/schedule"
import { registeredScheduler } from "./reminder-actions"
import { isWhatsAppJid } from "./contacts"

/**
 * Convites de reunião enviados pelo WhatsApp.
 *
 * O convite é enviado com 3 botões (`Confirmar` / `Reagendar` / `Não poderei`).
 * O `scheduleId` viaja no id do botão, então o registro da reunião é persistido
 * na própria agenda (Schedule) — a resposta continua válida mesmo após um
 * restart, sem depender de estado em memória.
 */

export interface MeetingMetadata {
  contactJid: string
  contactName?: string
  title: string
  status: "pending" | "confirmed" | "declined" | "reschedule"
  /** Conversa (JID) de quem pediu o convite, para avisar sobre a resposta. */
  requesterChat?: string
  requesterAgentId?: string
}

export function meetingButtons(scheduleId: string) {
  return [
    { id: `meeting:confirm:${scheduleId}`, text: "Confirmar" },
    { id: `meeting:reschedule:${scheduleId}`, text: "Reagendar" },
    { id: `meeting:decline:${scheduleId}`, text: "Não poderei" },
  ]
}

/** Lê o bloco `meeting` do metadata de um Schedule. */
export function meetingRecord(metadata: Record<string, unknown> | undefined): MeetingMetadata | undefined {
  const raw = metadata?.["meeting"]
  if (!raw || typeof raw !== "object") return undefined
  const value = raw as Record<string, unknown>
  if (typeof value["contactJid"] !== "string" || typeof value["title"] !== "string") return undefined
  return {
    contactJid: value["contactJid"],
    contactName: typeof value["contactName"] === "string" ? value["contactName"] : undefined,
    title: value["title"],
    status:
      value["status"] === "confirmed" || value["status"] === "declined" || value["status"] === "reschedule"
        ? value["status"]
        : "pending",
    requesterChat: typeof value["requesterChat"] === "string" ? value["requesterChat"] : undefined,
    requesterAgentId: typeof value["requesterAgentId"] === "string" ? value["requesterAgentId"] : undefined,
  }
}

/** Aceita ISO-8601 ou `YYYY-MM-DD HH:mm`. */
export function parseMeetingDate(input: string): number | undefined {
  const parsed = Date.parse(input)
  if (!Number.isNaN(parsed)) return parsed

  const match = input.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return undefined
  const [, y, m, d, h, min, s] = match
  return new Date(
    Number.parseInt(y, 10),
    Number.parseInt(m, 10) - 1,
    Number.parseInt(d, 10),
    Number.parseInt(h, 10),
    Number.parseInt(min, 10),
    s ? Number.parseInt(s, 10) : 0,
  ).getTime()
}

export interface MeetingActionResult {
  readonly reply: string
  readonly requester?: { readonly to: string; readonly text: string }
}

const STATUS_TEXT: Record<MeetingMetadata["status"], (meeting: MeetingMetadata) => string> = {
  pending: () => "Resposta registrada.",
  confirmed: (meeting) =>
    `✅ ${meeting.contactName ?? "O contato"} confirmou a reunião "${meeting.title}".`,
  declined: (meeting) =>
    `❌ ${meeting.contactName ?? "O contato"} não poderá comparecer à reunião "${meeting.title}".`,
  reschedule: (meeting) =>
    `🔁 ${meeting.contactName ?? "O contato"} pediu para reagendar a reunião "${meeting.title}".`,
}

/**
 * Processa o toque em um botão `meeting:<verb>:<scheduleId>`.
 * Devolve o texto para responder ao contato e, quando aplicável, a mensagem
 * para avisar quem pediu o convite.
 */
export function runMeetingAction(id: string): Effect.Effect<MeetingActionResult> {
  return Effect.gen(function* () {
    const [, verb, scheduleId] = id.split(":")
    if (!scheduleId) return { reply: "Não entendi a resposta do convite (id incompleto)." }

    const schedules = Option.getOrUndefined(yield* Effect.serviceOption(Schedule.Service)) ?? registeredScheduler()
    if (!schedules) return { reply: "A agenda não está disponível neste processo." }

    const sid = Schedule.ID.make(scheduleId)
    const found = yield* schedules.get(sid)
    if (!found) return { reply: "Convite não encontrado (talvez já tenha sido respondido)." }

    const meeting = meetingRecord(found.metadata)
    if (!meeting) return { reply: "Este agendamento não é um convite de reunião." }

    const status: MeetingMetadata["status"] | undefined =
      verb === "confirm"
        ? "confirmed"
        : verb === "decline"
          ? "declined"
          : verb === "reschedule"
            ? "reschedule"
            : undefined
    if (!status) return { reply: "Resposta desconhecida para este convite." }

    const updated: MeetingMetadata = { ...meeting, status }
    // Recusar ou pedir para reagendar tira o lembrete do horário original:
    // só uma reunião confirmada continua disparando no horário marcado.
    yield* schedules.update(sid, {
      name: found.name,
      description: found.description,
      trigger: found.trigger,
      action: found.action,
      workspace: found.workspace,
      enabled: status === "confirmed" ? found.enabled : false,
      metadata: { ...found.metadata, meeting: updated },
    })

    const requesterChat = meeting.requesterChat && isWhatsAppJid(meeting.requesterChat) ? meeting.requesterChat : undefined
    return {
      reply:
        status === "confirmed"
          ? "✅ Reunião confirmada. Obrigado!"
          : status === "declined"
            ? "Tudo bem, obrigado por avisar."
            : "Sem problemas! Qual dia e horário ficam melhores para você?",
      requester: requesterChat ? { to: requesterChat, text: STATUS_TEXT[status](updated) } : undefined,
    }
  }).pipe(
    Effect.catchCause((cause) => {
      const error = Cause.squash(cause)
      return Effect.succeed({
        reply: `Não foi possível processar a resposta do convite: ${error instanceof Error ? error.message : String(error)}`,
      })
    }),
  )
}

export * as WhatsAppMeetings from "./meetings"
