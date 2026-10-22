import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { Database } from "@allcode/core/database/database"
import { AppNodeBuilder } from "@allcode/core/effect/app-node-builder"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { Schedule } from "@allcode/core/schedule"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { testEffect } from "./lib/effect"

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
})
