export * as ScheduleRunner from "./runner"

import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { Context, Duration, Effect, Layer, Schema, Schedule as EffectSchedule, Semaphore } from "effect"
import { desc, eq, lt } from "drizzle-orm"
import { Schedule } from "../schedule"
import { Database } from "../database/database"
import { DaemonHeartbeatTable, ScheduleRunTable } from "./sql"
import { makeGlobalNode } from "../effect/app-node"

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Schedule.NotFoundError", {
  id: Schedule.ID,
}) {}

export { DaemonHeartbeatTable, ScheduleRunTable } from "./sql"
export { eq, lt } from "drizzle-orm"

export const PROCESS_INSTANCE_ID = randomUUID()
export const LEADER_TIMEOUT_MS = 45_000
export const MAX_PAYLOAD_CHARS = 8_192 // Teto de 8 KB para campos textuais
export const RETENTION_DAYS_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

export function truncatePayload(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length <= MAX_PAYLOAD_CHARS) return value
  return value.slice(0, MAX_PAYLOAD_CHARS) + `... [truncated at ${MAX_PAYLOAD_CHARS} chars]`
}

export const purgeOldRuns = Effect.fn("v2.Schedule.purgeOldRuns")(function* () {
  const { db } = yield* Database.Service
  const threshold = Date.now() - RETENTION_DAYS_MS
  yield* db
    .delete(ScheduleRunTable)
    .where(lt(ScheduleRunTable.started_at, threshold))
    .run()
    .pipe(Effect.orDie)
})

// Semáforos para segregação de concorrência por tipo de ação
export const shellSemaphore = Semaphore.makeUnsafe(2)
export const skillSemaphore = Semaphore.makeUnsafe(3)

function withActionPermit<A, E, R>(action: Schedule.Action, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
  if (action.kind === "shell") {
    return shellSemaphore.withPermits(1)(effect)
  }
  if (action.kind === "skill" || action.kind === "agentui") {
    return skillSemaphore.withPermits(1)(effect)
  }
  // reminder e mcp_tool têm despacho livre
  return effect
}

export const isLeader = Effect.fn("v2.Schedule.isLeader")(function* () {
  const { db } = yield* Database.Service
  const now = Date.now()

  const existing = yield* db
    .select()
    .from(DaemonHeartbeatTable)
    .where(eq(DaemonHeartbeatTable.instance_id, PROCESS_INSTANCE_ID))
    .get()
    .pipe(Effect.orDie)

  if (existing) {
    yield* db
      .update(DaemonHeartbeatTable)
      .set({ last_seen: now })
      .where(eq(DaemonHeartbeatTable.instance_id, PROCESS_INSTANCE_ID))
      .run()
      .pipe(Effect.orDie)
    return true
  }

  // Verificar se há outro líder ativo
  const threshold = now - LEADER_TIMEOUT_MS
  const staleLeaders = yield* db
    .select()
    .from(DaemonHeartbeatTable)
    .where(lt(DaemonHeartbeatTable.last_seen, threshold))
    .all()
    .pipe(Effect.orDie)

  // Limpar líderes antigos e inativos
  if (staleLeaders.length > 0) {
    yield* db
      .delete(DaemonHeartbeatTable)
      .where(lt(DaemonHeartbeatTable.last_seen, threshold))
      .run()
      .pipe(Effect.orDie)
  }

  const currentLeaders = yield* db.select().from(DaemonHeartbeatTable).all().pipe(Effect.orDie)
  if (currentLeaders.length === 0) {
    // Reivindicar liderança atomicamente
    yield* db
      .insert(DaemonHeartbeatTable)
      .values({
        instance_id: PROCESS_INSTANCE_ID,
        pid: process.pid,
        process_title: process.title || "allcode",
        last_seen: now,
      })
      .run()
      .pipe(Effect.orDie)
    return true
  }

  return false
})

export const releaseLeader = Effect.fn("v2.Schedule.releaseLeader")(function* () {
  const { db } = yield* Database.Service
  yield* db
    .delete(DaemonHeartbeatTable)
    .where(eq(DaemonHeartbeatTable.instance_id, PROCESS_INSTANCE_ID))
    .run()
    .pipe(Effect.orDie)
})

export interface SkillCallResult {
  readonly success: boolean
  readonly error?: string
  readonly sessionId?: string
}

export interface SkillCallerInterface {
  readonly runSkill: (
    action: Schedule.SkillAction,
    workspace: string | undefined,
    sessionId?: string,
  ) => Effect.Effect<SkillCallResult>
}

export class SkillCaller extends Context.Service<SkillCaller, SkillCallerInterface>()("@opencode/v2/Schedule/SkillCaller") {}

const skillCallerUnsupportedLayer = Layer.succeed(
  SkillCaller,
  SkillCaller.of({
    runSkill: () =>
      Effect.succeed({
        success: false,
        error: "Skill/AI actions require the OpenCode runtime session, not available in this standalone server process.",
      }),
  }),
)

export const skillCallerNode = makeGlobalNode({ service: SkillCaller, layer: skillCallerUnsupportedLayer, deps: [] })

export interface AgentUICallResult {
  readonly success: boolean
  readonly error?: string
  readonly reply?: string
}

export interface AgentUICallerInterface {
  readonly runAgent: (
    action: Schedule.AgentUIAction,
    workspace: string | undefined,
  ) => Effect.Effect<AgentUICallResult>
}

export class AgentUICaller extends Context.Service<AgentUICaller, AgentUICallerInterface>()(
  "@opencode/v2/Schedule/AgentUICaller",
) {}

const agentUICallerUnsupportedLayer = Layer.succeed(
  AgentUICaller,
  AgentUICaller.of({
    runAgent: () =>
      Effect.succeed({
        success: false,
        error: "AgentUI actions require the OpenCode runtime session, not available in this standalone server process.",
      }),
  }),
)

export const agentUICallerNode = makeGlobalNode({ service: AgentUICaller, layer: agentUICallerUnsupportedLayer, deps: [] })

export interface ReminderCallResult {
  readonly success: boolean
  readonly error?: string
}

export interface ReminderCallerInterface {
  readonly notifyReminder: (
    action: Schedule.ReminderAction,
    workspace: string | undefined,
  ) => Effect.Effect<ReminderCallResult>
}

export class ReminderCaller extends Context.Service<ReminderCaller, ReminderCallerInterface>()(
  "@opencode/v2/Schedule/ReminderCaller",
) {}

const reminderCallerDefaultLayer = Layer.succeed(
  ReminderCaller,
  ReminderCaller.of({
    notifyReminder: (action) =>
      Effect.sync(() => {
        // Default in-process log/notification fallback
        console.log(`[REMINDER ALERTA] 🔔 ${action.title}: ${action.message}`)
        return { success: true }
      }),
  }),
)

export const reminderCallerNode = makeGlobalNode({ service: ReminderCaller, layer: reminderCallerDefaultLayer, deps: [] })

export interface McpCallResult {
  readonly success: boolean
  readonly error?: string
}

export interface McpCallerInterface {
  readonly callTool: (
    server: string,
    tool: string,
    args: Record<string, unknown> | undefined,
  ) => Effect.Effect<McpCallResult>
}

/**
 * mcp_tool actions call an MCP client living in the legacy opencode process
 * (packages/opencode's MCP.Service), which packages/core can't depend on
 * directly. This is a swappable dependency: packages/opencode replaces this
 * node with a real implementation wired to its MCP.Service; anything running
 * without that process (the standalone V2 daemon) keeps this "unsupported"
 * default instead of silently no-op'ing.
 */
export class McpCaller extends Context.Service<McpCaller, McpCallerInterface>()("@opencode/v2/Schedule/McpCaller") {}

const mcpCallerUnsupportedLayer = Layer.succeed(
  McpCaller,
  McpCaller.of({
    callTool: () =>
      Effect.succeed({
        success: false,
        error: "mcp_tool actions require the desktop app's MCP connections, not available in this server process.",
      }),
  }),
)

export const mcpCallerNode = makeGlobalNode({ service: McpCaller, layer: mcpCallerUnsupportedLayer, deps: [] })

const DEFAULT_TIMEOUT_MS = 1_800_000 // 30 minutos

function executeCommand(
  command: string,
  cwd?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ exitCode: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const proc = spawn(command, {
        shell: true,
        cwd: cwd || process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stderr = ""
      let settled = false
      let timer: NodeJS.Timeout | undefined

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (settled) return
          settled = true
          try {
            if (process.platform === "win32") {
              proc.kill()
            } else {
              proc.kill("SIGKILL")
            }
          } catch {
            // ignore kill errors
          }
          resolve({ exitCode: 1, error: `timeout after ${timeoutMs}ms` })
        }, timeoutMs)
        timer.unref?.()
      }

      proc.stderr?.on("data", (chunk) => {
        stderr += chunk.toString()
      })

      proc.on("close", (code) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        const exitCode = code === 0 ? 0 : (code ?? 1)
        resolve({
          exitCode,
          error: exitCode !== 0 ? stderr.trim() || `Process exited with code ${code}` : undefined,
        })
      })

      proc.on("error", (err) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        resolve({ exitCode: 1, error: err.message })
      })
    } catch (err: any) {
      resolve({ exitCode: 1, error: err?.message ?? String(err) })
    }
  })
}

/**
 * skill actions need Session/Batuta, which don't have a V2/core runtime yet
 * (see #213/#217 discussion) -- recorded and skipped with a clear error
 * rather than silently no-op'd, until that lands. mcp_tool is handled via
 * the swappable McpCaller dependency above.
 */
function runAction(action: Schedule.Action, workspace: string | undefined, sessionId?: string) {
  const timeoutMs =
    "timeoutMs" in action && typeof action.timeoutMs === "number" && action.timeoutMs > 0
      ? action.timeoutMs
      : DEFAULT_TIMEOUT_MS

  if (action.kind === "shell") {
    return Effect.promise(() => executeCommand(action.command, workspace, timeoutMs)).pipe(
      Effect.map((res) => ({ exitCode: res.exitCode, error: res.error, sessionId: undefined })),
    )
  }
  if (action.kind === "mcp_tool") {
    return Effect.gen(function* () {
      const caller = yield* McpCaller
      const result: McpCallResult = yield* caller.callTool(action.server, action.tool, action.args).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms` }),
        }),
      )
      return { exitCode: result.success ? 0 : 1, error: result.error, sessionId: undefined }
    })
  }
  if (action.kind === "skill") {
    return Effect.gen(function* () {
      const caller = yield* SkillCaller
      const result: SkillCallResult = yield* caller.runSkill(action, workspace, sessionId).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms`, sessionId }),
        }),
      )
      return { exitCode: result.success ? 0 : 1, error: result.error, sessionId: result.sessionId ?? sessionId }
    })
  }
  if (action.kind === "agentui") {
    return Effect.gen(function* () {
      const caller = yield* AgentUICaller
      const result: AgentUICallResult = yield* caller.runAgent(action, workspace).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms` }),
        }),
      )
      return { exitCode: result.success ? 0 : 1, error: result.error, sessionId: undefined }
    })
  }
  if (action.kind === "reminder") {
    return Effect.gen(function* () {
      const caller = yield* ReminderCaller
      const result: ReminderCallResult = yield* caller.notifyReminder(action, workspace).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms` }),
        }),
      )
      return { exitCode: result.success ? 0 : 1, error: result.error, sessionId: undefined }
    })
  }
  return Effect.succeed({
    exitCode: 1,
    error: `Action kind "${(action as any).kind}" is not yet supported by the schedule runner.`,
    sessionId: undefined,
  })
}

/** Runs an action with 1 immediate courtesy retry on failure. */
function runActionWithRetry(action: Schedule.Action, workspace: string | undefined, sessionId?: string) {
  return Effect.gen(function* () {
    const firstAttempt = yield* runAction(action, workspace, sessionId)
    if (firstAttempt.exitCode === 0) {
      return firstAttempt
    }

    // 1 Retry imediato de cortesia para absorver falhas transientes
    yield* Effect.logWarning(`[Schedule] Action failed, performing 1 courtesy retry... (${firstAttempt.error})`)
    const secondAttempt = yield* runAction(action, workspace, sessionId)
    return secondAttempt
  })
}

/** Executes an action directly as a dry-run test/validation without needing a saved Schedule ID */
export const testAction = Effect.fn("v2.Schedule.testAction")(function* (
  action: Schedule.Action,
  workspace?: string,
) {
  const result = yield* runAction(action, workspace)
  return {
    success: result.exitCode === 0,
    error: result.error,
    sessionId: result.sessionId,
  }
})

/** Runs one schedule's action immediately, regardless of trigger/enabled state, and records the result. */
export const runOne = Effect.fn("v2.Schedule.runOne")(function* (id: Schedule.ID) {
  const schedules = yield* Schedule.Service
  const { db } = yield* Database.Service
  const schedule = yield* schedules.get(id)
  if (!schedule) return yield* Effect.fail(new NotFoundError({ id }))

  const startTime = Date.now()
  const result = yield* runActionWithRetry(schedule.action, schedule.workspace, schedule.lastSessionId)
  const durationMs = Date.now() - startTime
  const isSuccess = result.exitCode === 0
  const truncatedError = truncatePayload(result.error)

  // Gravar histórico de execução na tabela schedule_run
  yield* db
    .insert(ScheduleRunTable)
    .values({
      id: "run_" + randomUUID(),
      schedule_id: schedule.id,
      started_at: startTime,
      duration_ms: durationMs,
      status: isSuccess ? "success" : "error",
      error: truncatedError,
      session_id: result.sessionId ?? schedule.lastSessionId,
    })
    .run()
    .pipe(Effect.orDie)

  const updated = yield* schedules.update(schedule.id, {
    lastRunAt: startTime,
    lastStatus: isSuccess ? "success" : "error",
    lastError: isSuccess ? null : (truncatedError ?? null),
    lastSessionId: result.sessionId ?? schedule.lastSessionId,
  })
  return updated!
})

const tick = Effect.fn("v2.Schedule.tick")(function* () {
  const leader = yield* isLeader()
  if (!leader) {
    return
  }

  const schedules = yield* Schedule.Service
  const now = new Date()
  const nowMs = now.getTime()

  const eligibleSchedules: Schedule.Info[] = []

  for (const schedule of yield* schedules.list()) {
    if (!schedule.enabled) continue
    if (schedule.trigger.kind === "manual") continue

    if (schedule.trigger.kind === "once") {
      if (schedule.lastRunAt || nowMs < schedule.trigger.timestamp) continue
    } else if (schedule.trigger.kind === "interval") {
      if (schedule.lastRunAt && nowMs - schedule.lastRunAt < schedule.trigger.ms) continue
    } else {
      if (schedule.lastRunAt && nowMs - schedule.lastRunAt < 59_000) continue

      const matchesNow = Schedule.matchesCron(schedule.trigger.expr, now)
      const missedWhileOffline =
        schedule.lastRunAt != null && Schedule.hasCronRunBetween(schedule.trigger.expr, schedule.lastRunAt, nowMs)

      if (!matchesNow && !missedWhileOffline) continue
      if (missedWhileOffline && !matchesNow) {
        yield* Effect.logInfo(
          `[Schedule] Task ${schedule.id} catching up missed execution (scheduled between last run and now)`,
        )
      }
    }

    eligibleSchedules.push(schedule)
  }

  // Disparo concorrente controlado por semáforos por tipo de ação
  yield* Effect.forEach(
    eligibleSchedules,
    (schedule) =>
      withActionPermit(
        schedule.action,
        Effect.gen(function* () {
          const { db } = yield* Database.Service
          const startTime = Date.now()
          const result = yield* runActionWithRetry(schedule.action, schedule.workspace, schedule.lastSessionId)
          const durationMs = Date.now() - startTime
          const isSuccess = result.exitCode === 0
          const truncatedError = truncatePayload(result.error)

          // Gravar histórico de execução na tabela schedule_run
          yield* db
            .insert(ScheduleRunTable)
            .values({
              id: "run_" + randomUUID(),
              schedule_id: schedule.id,
              started_at: startTime,
              duration_ms: durationMs,
              status: isSuccess ? "success" : "error",
              error: truncatedError,
              session_id: result.sessionId ?? schedule.lastSessionId,
            })
            .run()
            .pipe(Effect.orDie)

          yield* schedules.update(schedule.id, {
            lastRunAt: startTime,
            enabled: schedule.trigger.kind === "once" ? false : schedule.enabled,
            lastStatus: isSuccess ? "success" : "error",
            lastError: isSuccess ? null : (truncatedError ?? null),
            lastSessionId: result.sessionId ?? schedule.lastSessionId,
          })

          if (result.exitCode === 0) yield* Effect.logInfo(`[Schedule] Task ${schedule.id} completed successfully`)
          else yield* Effect.logWarning(`[Schedule] Task ${schedule.id} failed: ${result.error}`)
        }),
      ),
    { concurrency: "unbounded" },
  )

  // Auto-purge de histórico com mais de 7 dias
  yield* purgeOldRuns().pipe(Effect.ignore)
})

const STARTUP_DELAY_SECONDS = 60

const tickLayer = Layer.effectDiscard(
  Effect.sleep(Duration.seconds(STARTUP_DELAY_SECONDS)).pipe(
    Effect.flatMap(() =>
      tick().pipe(
        Effect.catch(() =>
          Effect.gen(function* () {
            yield* Effect.logWarning(`[Schedule] Tick loop encountered unexpected error, recovering...`)
            yield* Effect.sleep(Duration.seconds(5))
          }),
        ),
        Effect.repeat(EffectSchedule.spaced(Duration.seconds(30))),
      ),
    ),
    Effect.forkScoped,
  ),
)

export const tickNode = makeGlobalNode({
  name: "schedule-tick",
  layer: Layer.merge(Schedule.layer, tickLayer.pipe(Layer.provide(Schedule.layer))),
  deps: [Database.node, Database.globalNode, mcpCallerNode, skillCallerNode, agentUICallerNode, reminderCallerNode],
})
