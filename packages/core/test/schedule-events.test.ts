import { describe, expect } from "bun:test"
import { Effect, Schema } from "effect"
import { Database } from "@allcode/core/database/database"
import { AppNodeBuilder } from "@allcode/core/effect/app-node-builder"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { EventV2 } from "@allcode/core/event"
import { Schedule } from "@allcode/core/schedule"
import { testEffect } from "./lib/effect"

describe("Schedule events", () => {
  const it = testEffect(AppNodeBuilder.build(LayerNode.group([Database.node, EventV2.node, Schedule.node])))

  it.live("publishes created, updated and deleted for explicit mutations", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const events = yield* EventV2.Service
      const seen: string[] = []
      const unsubscribe = yield* events.listen((event) =>
        Effect.sync(() => {
          if (event.type.startsWith("schedule.")) {
            const data = Schema.decodeUnknownSync(Schedule.Event.Created.data)(event.data)
            seen.push(`${event.type}:${data.id}`)
          }
        }),
      )
      yield* Effect.addFinalizer(() => unsubscribe)

      const created = yield* schedules.create({
        name: "Event routine",
        trigger: { kind: "manual" },
        action: { kind: "shell", command: "echo ok" },
      })
      yield* schedules.update(created.id, { enabled: false })
      yield* schedules.remove(created.id)

      expect(seen).toEqual([
        `schedule.created:${created.id}`,
        `schedule.updated:${created.id}`,
        `schedule.deleted:${created.id}`,
      ])
    }),
  )

  it.live("does not emit for idempotent retries or missing routines", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const events = yield* EventV2.Service
      const seen: string[] = []
      const unsubscribe = yield* events.listen((event) =>
        Effect.sync(() => {
          if (event.type.startsWith("schedule.")) seen.push(event.type)
        }),
      )
      yield* Effect.addFinalizer(() => unsubscribe)

      const input = {
        name: "Idempotent routine",
        trigger: { kind: "manual" as const },
        action: { kind: "shell" as const, command: "echo ok" },
        idempotencyKey: "schedule-events-idempotent",
      }
      const created = yield* schedules.create(input)
      seen.length = 0

      const retried = yield* schedules.create(input)
      expect(retried.id).toBe(created.id)
      expect(seen).toEqual([])

      yield* schedules.remove(Schedule.ID.make("sch_missing"))
      expect(seen).toEqual([])
    }),
  )
})
