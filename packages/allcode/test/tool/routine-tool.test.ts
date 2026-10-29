import { describe, expect } from "bun:test"
import { AppNodeBuilder } from "@allcode/core/effect/app-node-builder"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { Database } from "@allcode/core/database/database"
import { Schedule } from "@allcode/core/schedule"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { Effect } from "effect"
import { Agent } from "../../src/agent/agent"
import { MessageID, SessionID } from "../../src/session/schema"
import { Storage } from "../../src/storage/storage"
import { RoutineTool } from "../../src/tool/routine"
import { Tool } from "../../src/tool/tool"
import { Truncate } from "../../src/tool/truncate"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      Database.node,
      Schedule.node,
      Storage.node,
      Truncate.node,
      Agent.node,
    ]),
    [],
  ),
)

function makeCtx(): Tool.Context {
  return {
    sessionID: SessionID.descending(),
    messageID: MessageID.ascending(),
    agent: "build",
    abort: new AbortController().signal,
    messages: [],
    metadata() {
      return Effect.void
    },
    ask() {
      return Effect.void
    },
  }
}

function body(result: { output: string }) {
  return JSON.parse(result.output)
}

describe("routine tool integration flow", () => {
  it.instance(
    "creates, reports status, deduplicates and restarts a failed routine",
    () =>
      Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const okCaller = { success: true } as const
      const dispose = yield* ScheduleRunner.registerRestartBridge((id) =>
        ScheduleRunner.restartOne(id).pipe(
          Effect.provideService(Schedule.Service, schedules),
          Effect.provideService(
            ScheduleRunner.McpCaller,
            ScheduleRunner.McpCaller.of({ callTool: () => Effect.succeed(okCaller) }),
          ),
          Effect.provideService(
            ScheduleRunner.SkillCaller,
            ScheduleRunner.SkillCaller.of({ runSkill: () => Effect.succeed(okCaller) }),
          ),
          Effect.provideService(
            ScheduleRunner.AgentUICaller,
            ScheduleRunner.AgentUICaller.of({ runAgent: () => Effect.succeed(okCaller) }),
          ),
          Effect.provideService(
            ScheduleRunner.ReminderCaller,
            ScheduleRunner.ReminderCaller.of({ notifyReminder: () => Effect.succeed(okCaller) }),
          ),
        ),
      )
      yield* Effect.addFinalizer(() => Effect.sync(dispose))

      const tool = yield* Tool.init(yield* RoutineTool)
      const execute = tool.execute as unknown as (
        args: unknown,
        ctx: Tool.Context,
      ) => Effect.Effect<{ output: string; metadata: Record<string, unknown> }>
      const ctx = makeCtx()

      const created = yield* execute(
        {
          action: "create",
          name: "Integration routine",
          prompt: "Do the thing.",
          schedule: { kind: "manual" },
          idempotencyKey: "integration-1",
        },
        ctx,
      )
      const createBody = body(created)
      expect(createBody.ok).toBe(true)
      expect(createBody.data.status).toBe("created")
      const routineId = createBody.data.routineId as string

      const retried = yield* execute(
        {
          action: "create",
          name: "Integration routine",
          prompt: "Do the thing.",
          schedule: { kind: "manual" },
          idempotencyKey: "integration-1",
        },
        ctx,
      )
      expect(body(retried)).toMatchObject({ ok: true, data: { routineId, status: "existing" } })

      const queued = yield* execute({ action: "status", routineId }, ctx)
      expect(body(queued)).toMatchObject({ ok: true, data: { routines: [{ state: "queued" }] } })

      const { db } = yield* Database.Service
      const failedAt = Date.now() - 60_000
      yield* db
        .insert(ScheduleRunner.ScheduleRunTable)
        .values({
          id: "run_failed_integration",
          schedule_id: routineId,
          started_at: failedAt,
          duration_ms: 1,
          status: "error",
          error: "boom",
          attempt: 1,
          finished_at: failedAt,
        })
        .run()
        .pipe(Effect.orDie)

      const failed = yield* execute({ action: "status", routineId }, ctx)
      expect(body(failed)).toMatchObject({
        ok: true,
        data: { routines: [{ state: "failed", lastError: "boom", attempts: 1 }] },
      })

      const unconfirmed = yield* execute({ action: "restart", routineId }, ctx)
      expect(body(unconfirmed)).toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } })

      const restarted = yield* execute({ action: "restart", routineId, confirm: true }, ctx)
      expect(body(restarted)).toMatchObject({
        ok: true,
        data: { routineId, previousState: "failed", newState: "running", attempt: 2 },
      })

      const latest = yield* schedules.latestRun(Schedule.ID.make(routineId))
      expect(latest?.attempt).toBe(2)
      }),
    60_000,
  )
})
