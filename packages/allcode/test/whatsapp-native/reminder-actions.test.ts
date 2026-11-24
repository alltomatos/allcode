import { expect, it } from "bun:test"
import { Effect } from "effect"
import { Schedule } from "@allcode/core/schedule"
import { reminderButtons } from "../../src/schedule/reminder-caller"
import { runReminderAction } from "../../src/whatsapp-native/reminder-actions"

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

function reminder(id: string): Schedule.Info {
  return {
    id: Schedule.ID.make(id),
    name: "Reunião",
    description: "Reunião com o cliente",
    trigger: { kind: "once", timestamp: Date.now() - 1000 },
    action: { kind: "reminder", title: "Reunião", message: "Reunião com o cliente" },
    enabled: true,
  }
}

it("os botões enviados usam ids que o roteador de ações entende", async () => {
  const buttons = reminderButtons("sch_1")
  expect(buttons.map((button) => button.text)).toEqual(["Concluir", "Adiar 10 min", "Cancelar"])
  expect(buttons.map((button) => button.id)).toEqual([
    "reminder:done:sch_1",
    "reminder:snooze:sch_1:10",
    "reminder:cancel:sch_1",
  ])

  const { store, service } = fakeSchedules([reminder("sch_1")])
  await Effect.runPromise(
    runReminderAction(buttons[1]!.id).pipe(Effect.provideService(Schedule.Service, service)),
  )
  expect(store.get("sch_1")?.enabled).toBe(true)
})

it("concluir desabilita o lembrete", async () => {
  const { store, service } = fakeSchedules([reminder("sch_1")])
  const reply = await Effect.runPromise(runReminderAction("reminder:done:sch_1").pipe(Effect.provideService(Schedule.Service, service)))

  expect(reply).toContain("concluído")
  expect(store.get("sch_1")?.enabled).toBe(false)
})

it("adiar reagenda para o futuro e reativa o lembrete", async () => {
  const { store, service } = fakeSchedules([reminder("sch_1")])
  const reply = await Effect.runPromise(
    runReminderAction("reminder:snooze:sch_1:15").pipe(Effect.provideService(Schedule.Service, service)),
  )

  expect(reply).toContain("15 minutos")
  const item = store.get("sch_1")
  expect(item?.enabled).toBe(true)
  expect(item?.trigger.kind).toBe("once")
  if (item?.trigger.kind === "once") expect(item.trigger.timestamp).toBeGreaterThan(Date.now())
})

it("cancelar remove o lembrete", async () => {
  const { store, service } = fakeSchedules([reminder("sch_1")])
  const reply = await Effect.runPromise(
    runReminderAction("reminder:cancel:sch_1").pipe(Effect.provideService(Schedule.Service, service)),
  )

  expect(reply).toContain("cancelado")
  expect(store.has("sch_1")).toBe(false)
})

it("id inválido ou lembrete ausente vira resposta explícita", async () => {
  const { service } = fakeSchedules([])
  const incomplete = await Effect.runPromise(
    runReminderAction("reminder:done").pipe(Effect.provideService(Schedule.Service, service)),
  )
  expect(incomplete).toContain("id incompleto")

  const missing = await Effect.runPromise(
    runReminderAction("reminder:done:sch_missing").pipe(Effect.provideService(Schedule.Service, service)),
  )
  expect(missing).toContain("não encontrado")
})
