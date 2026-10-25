import { describe, expect } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { eq } from "drizzle-orm"
import { Effect, Layer } from "effect"
import { Database } from "@allcode/core/database/database"
import { AppNodeBuilder } from "@allcode/core/effect/app-node-builder"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { Schedule } from "@allcode/core/schedule"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { testEffect } from "./lib/effect"

function waitFor(check: () => Effect.Effect<boolean>, timeoutMs: number) {
  return Effect.gen(function* () {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (yield* check()) return
      yield* Effect.sleep("50 millis")
    }
    expect(false).toBe(true)
  })
}

const mockMcpCaller = (handler: ScheduleRunner.McpCallerInterface["callTool"]) =>
  Layer.succeed(
    ScheduleRunner.McpCaller,
    ScheduleRunner.McpCaller.of({
      callTool: handler,
    }),
  )

describe("ScheduleRunner execution and timeout", () => {
  const it = testEffect(
    AppNodeBuilder.build(
      LayerNode.group([
        Database.node,
        Schedule.node,
        ScheduleRunner.mcpCallerNode,
        ScheduleRunner.skillCallerNode,
        ScheduleRunner.agentUICallerNode,
        ScheduleRunner.reminderCallerNode,
      ]),
      [[ScheduleRunner.mcpCallerNode, mockMcpCaller((server, tool) => {
        if (server === "disconnected") {
          return Effect.succeed({ success: false, error: `MCP server "${server}" is not connected` })
        }
        if (tool === "missing") {
          return Effect.succeed({ success: false, error: `MCP tool "${tool}" not found on server "${server}"` })
        }
        if (tool === "slow") {
          return Effect.sleep("200 millis").pipe(Effect.as({ success: true }))
        }
        return Effect.succeed({ success: true })
      })]],
    ),
  )

  it.live("executes shell command successfully", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: { kind: "shell", command: 'node -e "console.log(123)"' },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id)
      expect(executed.lastStatus).toBe("success")
      expect(executed.lastError).toBeUndefined()
    }),
  )

  it.live("enforces timeout on slow shell command", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: {
          kind: "shell",
          command: 'node -e "setTimeout(() => {}, 5000)"',
          timeoutMs: 100,
        },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id)
      expect(executed.lastStatus).toBe("error")
      expect(executed.lastError).toBe("timeout after 100ms")
    }),
  )

  it.live("handles mcp_tool success without agent session", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: {
          kind: "mcp_tool",
          server: "github",
          tool: "list_issues",
          args: { repo: "test" },
        },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id)
      expect(executed.lastStatus).toBe("success")
      expect(executed.lastError).toBeUndefined()
    }),
  )

  it.live("records error when MCP server is disconnected", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: {
          kind: "mcp_tool",
          server: "disconnected",
          tool: "some_tool",
        },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id)
      expect(executed.lastStatus).toBe("error")
      expect(executed.lastError).toBe('MCP server "disconnected" is not connected')
    }),
  )

  it.live("records error when MCP tool is not found", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: {
          kind: "mcp_tool",
          server: "github",
          tool: "missing",
        },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id)
      expect(executed.lastStatus).toBe("error")
      expect(executed.lastError).toBe('MCP tool "missing" not found on server "github"')
    }),
  )

  it.live("enforces timeout on slow mcp_tool", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: {
          kind: "mcp_tool",
          server: "github",
          tool: "slow",
          timeoutMs: 50,
        },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id)
      expect(executed.lastStatus).toBe("error")
      expect(executed.lastError).toBe("timeout after 50ms")
    }),
  )

  it.live("records execution in schedule_run and truncates large errors", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const { db } = yield* Database.Service
      const longMessage = "A".repeat(10_000)
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: {
          kind: "shell",
          command: `node -e "console.error('${longMessage}'); process.exit(1)"`,
        },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id)
      expect(executed.lastStatus).toBe("error")
      expect(executed.lastError).toBeDefined()
      expect(executed.lastError!.length).toBeLessThanOrEqual(8_192 + 50)

      // Verificar que foi gravado na tabela schedule_run
      const runs = yield* db.select().from(ScheduleRunner.ScheduleRunTable).all().pipe(Effect.orDie)
      expect(runs.length).toBeGreaterThan(0)
      const lastRun = runs.find((r) => r.schedule_id === created.id)
      expect(lastRun).toBeDefined()
      expect(lastRun?.status).toBe("error")
      expect(lastRun?.error?.length).toBeLessThanOrEqual(8_192 + 50)
    }),
  )

  it.live("purges runs older than retention window", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const { db } = yield* Database.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: { kind: "shell", command: 'node -e "process.exit(0)"' },
        enabled: true,
      })

      // Inserir registro antigo simulado (8 dias atrás)
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000)
      yield* db
        .insert(ScheduleRunner.ScheduleRunTable)
        .values({
          id: "run_old_test",
          schedule_id: created.id,
          started_at: oldTimestamp,
          duration_ms: 100,
          status: "success",
        })
        .run()
        .pipe(Effect.orDie)

      // Executa o purge
      yield* ScheduleRunner.purgeOldRuns()

      // Confirma que o registro antigo foi deletado
      const foundOld = yield* db
        .select()
        .from(ScheduleRunner.ScheduleRunTable)
        .where(ScheduleRunner.eq(ScheduleRunner.ScheduleRunTable.id, "run_old_test"))
        .get()
        .pipe(Effect.orDie)

      expect(foundOld).toBeUndefined()
    }),
  )

  it.live("records manual runs in the schedule database even with an ambient location database", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const { db } = yield* Database.Service
      const directory = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), "schedule-scope-")))
      const other = yield* Database.makeFromPath(path.join(directory, "project.db"))

      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: { kind: "shell", command: 'node -e "process.exit(0)"' },
        enabled: true,
      })

      const executed = yield* ScheduleRunner.runOne(created.id).pipe(
        Effect.provideService(Database.Service, other),
      )
      expect(executed.lastStatus).toBe("success")

      const runs = yield* db
        .select()
        .from(ScheduleRunner.ScheduleRunTable)
        .where(eq(ScheduleRunner.ScheduleRunTable.schedule_id, created.id))
        .all()
        .pipe(Effect.orDie)
      expect(runs).toHaveLength(1)
      expect(runs[0]?.status).toBe("success")
    }),
  )

  it.live("creates the run as running and rejects a concurrent run for the same schedule", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const { db } = yield* Database.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: { kind: "shell", command: 'node -e "process.exit(0)"' },
        enabled: true,
      })

      const claim = {
        scheduleId: created.id,
        trigger: "manual" as const,
        claimedBy: "test",
        leaseUntil: Date.now() + 60_000,
      }

      const first = yield* schedules.startRun(claim)
      expect(first).toBeDefined()
      const second = yield* schedules.startRun(claim)
      expect(second).toBeUndefined()

      const running = yield* db
        .select()
        .from(ScheduleRunner.ScheduleRunTable)
        .where(eq(ScheduleRunner.ScheduleRunTable.id, first!.id))
        .get()
        .pipe(Effect.orDie)
      expect(running?.status).toBe("running")
      expect(running?.finished_at).toBeNull()

      yield* schedules.finishRun({
        runId: first!.id,
        scheduleId: created.id,
        startedAt: first!.startedAt,
        status: "success",
        durationMs: 1,
        sessionId: "ses_test",
      })

      const finished = yield* db
        .select()
        .from(ScheduleRunner.ScheduleRunTable)
        .where(eq(ScheduleRunner.ScheduleRunTable.id, first!.id))
        .get()
        .pipe(Effect.orDie)
      expect(finished?.status).toBe("success")
      expect(finished?.finished_at).toBeGreaterThan(0)
      expect(finished?.session_id).toBe("ses_test")
    }),
  )

  it.live("marks expired running executions as error", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const { db } = yield* Database.Service
      const created = yield* schedules.create({
        trigger: { kind: "manual" },
        action: { kind: "shell", command: 'node -e "process.exit(0)"' },
        enabled: true,
      })

      const run = yield* schedules.startRun({
        scheduleId: created.id,
        trigger: "manual",
        claimedBy: "test",
        leaseUntil: Date.now() - 1_000,
      })
      expect(run).toBeDefined()

      const count = yield* schedules.failStaleRuns(Date.now(), "stale execution")
      expect(count).toBeGreaterThanOrEqual(1)

      const row = yield* db
        .select()
        .from(ScheduleRunner.ScheduleRunTable)
        .where(eq(ScheduleRunner.ScheduleRunTable.id, run!.id))
        .get()
        .pipe(Effect.orDie)
      expect(row?.status).toBe("error")
      expect(row?.error).toBe("stale execution")
    }),
  )

  it.live("elects a single scheduler owner and fails over after release", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const first = { ownerId: "owner-a", pid: 1, processTitle: "a", ttlMs: 5_000 }
      const second = { ownerId: "owner-b", pid: 2, processTitle: "b", ttlMs: 5_000 }

      expect(yield* schedules.claimLease(first)).toBe(true)
      expect(yield* schedules.claimLease(second)).toBe(false)
      expect(yield* schedules.renewLease(first)).toBe(true)

      yield* schedules.releaseLease(first.ownerId)
      expect(yield* schedules.claimLease(second)).toBe(true)
    }),
  )

  it.live("tick returns before a long skill action finishes and keeps other routines running", () =>
    Effect.gen(function* () {
      const schedules = yield* Schedule.Service
      const { db } = yield* Database.Service

      const skill = yield* schedules.create({
        trigger: { kind: "interval", ms: 60_000 },
        action: { kind: "skill", instructions: "long task", timeoutMs: 10_000 },
        enabled: true,
      })
      const shell = yield* schedules.create({
        trigger: { kind: "interval", ms: 60_000 },
        action: { kind: "shell", command: 'node -e "process.exit(0)"' },
        enabled: true,
      })

      const fakeSkillCaller = ScheduleRunner.SkillCaller.of({
        runSkill: () =>
          Effect.sleep("1500 millis").pipe(Effect.as({ success: true, sessionId: "ses_long_task" })),
      })

      yield* Effect.scoped(
        Effect.gen(function* () {
          const scope = yield* Effect.scope
          const startedAt = Date.now()
          yield* ScheduleRunner.tick(scope)
          expect(Date.now() - startedAt).toBeLessThan(1_200)

          const running = yield* db
            .select()
            .from(ScheduleRunner.ScheduleRunTable)
            .where(eq(ScheduleRunner.ScheduleRunTable.schedule_id, skill.id))
            .get()
            .pipe(Effect.orDie)
          expect(running?.status).toBe("running")

          yield* waitFor(
            () =>
              Effect.gen(function* () {
                const row = yield* db
                  .select()
                  .from(ScheduleRunner.ScheduleRunTable)
                  .where(eq(ScheduleRunner.ScheduleRunTable.schedule_id, shell.id))
                  .get()
                  .pipe(Effect.orDie)
                return row?.status === "success"
              }),
            3_000,
          )

          // A rotina curta concluiu enquanto a skill longa continua em execução.
          const stillRunning = yield* db
            .select()
            .from(ScheduleRunner.ScheduleRunTable)
            .where(eq(ScheduleRunner.ScheduleRunTable.schedule_id, skill.id))
            .get()
            .pipe(Effect.orDie)
          expect(stillRunning?.status).toBe("running")

          yield* waitFor(
            () =>
              Effect.gen(function* () {
                const row = yield* db
                  .select()
                  .from(ScheduleRunner.ScheduleRunTable)
                  .where(eq(ScheduleRunner.ScheduleRunTable.schedule_id, skill.id))
                  .get()
                  .pipe(Effect.orDie)
                return row?.status === "success"
              }),
            5_000,
          )
        }),
      ).pipe(Effect.provideService(ScheduleRunner.SkillCaller, fakeSkillCaller))
    }),
  )
})
