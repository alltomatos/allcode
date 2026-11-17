import { expect, it } from "bun:test"
import { Effect } from "effect"
import { Schedule } from "@allcode/core/schedule"
import {
  meetingButtons,
  meetingRecord,
  parseMeetingDate,
  runMeetingAction,
} from "../../src/whatsapp-native/meetings"
import { deliveryJid, isWhatsAppJid } from "../../src/whatsapp-native/contacts"

function fakeSchedules(initial: Schedule.Info[]) {
  const store = new Map<string, Schedule.Info>(initial.map((item) => [String(item.id), item]))
  const service = {
    list: () => Effect.succeed([...store.values()]),
    get: (id: Schedule.ID) => Effect.succeed(store.get(String(id))),
    create: () => Effect.die("create não deveria ser chamado"),
    update: (id: Schedule.ID, updates: Schedule.UpdateInput) => {
      const current = store.get(String(id))
      if (!current) return Effect.succeed(undefined)
      const next = { ...current, ...updates, id: current.id } as Schedule.Info
      store.set(String(id), next)
      return Effect.succeed(next)
    },
    remove: (id: Schedule.ID) => {
      store.delete(String(id))
      return Effect.void
    },
  } as unknown as Schedule.Interface
  return { store, service }
}

function meeting(id: string, status: "pending" | "confirmed" | "declined" | "reschedule" = "pending"): Schedule.Info {
  return {
    id: Schedule.ID.make(id),
    name: "Reunião: Alinhamento",
    trigger: { kind: "once", timestamp: Date.now() + 60_000 },
    action: { kind: "reminder", title: "Alinhamento", message: "Reunião amanhã" },
    enabled: true,
    metadata: {
      meeting: {
        contactJid: "5511999999999@s.whatsapp.net",
        contactName: "Maria",
        title: "Alinhamento",
        status,
        requesterChat: "558588888888@s.whatsapp.net",
        requesterAgentId: "agent-1",
      },
    },
  }
}

it("os botões do convite usam ids que o roteador de reunião entende", () => {
  const buttons = meetingButtons("sch_1")
  expect(buttons.map((button) => button.text)).toEqual(["Confirmar", "Reagendar", "Não poderei"])
  expect(buttons.map((button) => button.id)).toEqual([
    "meeting:confirm:sch_1",
    "meeting:reschedule:sch_1",
    "meeting:decline:sch_1",
  ])
})

it("confirmar marca a reunião e avisa quem pediu o convite", async () => {
  const { store, service } = fakeSchedules([meeting("sch_1")])
  const result = await Effect.runPromise(
    runMeetingAction("meeting:confirm:sch_1").pipe(Effect.provideService(Schedule.Service, service)),
  )

  expect(result.reply).toContain("confirmada")
  expect(result.requester?.to).toBe("558588888888@s.whatsapp.net")
  expect(result.requester?.text).toContain("confirmou")
  expect(meetingRecord(store.get("sch_1")?.metadata)?.status).toBe("confirmed")
})

it("recusar e reagendar atualizam o status", async () => {
  const decline = fakeSchedules([meeting("sch_1")])
  const declined = await Effect.runPromise(
    runMeetingAction("meeting:decline:sch_1").pipe(Effect.provideService(Schedule.Service, decline.service)),
  )
  expect(declined.reply).toContain("Tudo bem")
  expect(meetingRecord(decline.store.get("sch_1")?.metadata)?.status).toBe("declined")

  const reschedule = fakeSchedules([meeting("sch_2")])
  const asked = await Effect.runPromise(
    runMeetingAction("meeting:reschedule:sch_2").pipe(Effect.provideService(Schedule.Service, reschedule.service)),
  )
  expect(asked.reply).toContain("Qual dia")
  expect(meetingRecord(reschedule.store.get("sch_2")?.metadata)?.status).toBe("reschedule")
})

it("id inválido, reunião ausente ou agendamento comum viram resposta explícita", async () => {
  const empty = fakeSchedules([])
  const incomplete = await Effect.runPromise(
    runMeetingAction("meeting:confirm").pipe(Effect.provideService(Schedule.Service, empty.service)),
  )
  expect(incomplete.reply).toContain("id incompleto")

  const missing = await Effect.runPromise(
    runMeetingAction("meeting:confirm:sch_missing").pipe(Effect.provideService(Schedule.Service, empty.service)),
  )
  expect(missing.reply).toContain("não encontrado")

  const common = fakeSchedules([{ ...meeting("sch_3"), metadata: undefined }])
  const notMeeting = await Effect.runPromise(
    runMeetingAction("meeting:confirm:sch_3").pipe(Effect.provideService(Schedule.Service, common.service)),
  )
  expect(notMeeting.reply).toContain("não é um convite")
})

it("parseMeetingDate entende ISO e YYYY-MM-DD HH:mm", () => {
  expect(parseMeetingDate("2026-11-12T15:00:00-03:00")).toBe(Date.parse("2026-11-12T15:00:00-03:00"))
  expect(parseMeetingDate("2026-11-12 15:00")).toBe(new Date(2026, 10, 12, 15, 0, 0).getTime())
  expect(parseMeetingDate("amanhã")).toBeUndefined()
})

it("normaliza contatos: telefone vira JID e sandbox não é JID", () => {
  expect(isWhatsAppJid("sandbox")).toBe(false)
  expect(isWhatsAppJid("5511999999999@s.whatsapp.net")).toBe(true)
  expect(deliveryJid({ jid: "123@lid", phone: "5511999999999" })).toBe("5511999999999@s.whatsapp.net")
  expect(deliveryJid({ jid: "123@lid" })).toBe("123@lid")
})
