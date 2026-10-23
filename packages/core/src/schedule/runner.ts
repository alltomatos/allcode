export * as ScheduleRunner from "./runner"

import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import {
  Cause,
  Context,
  Duration,
  Effect,
  Exit,
  Layer,
  Schedule as EffectSchedule,
  Schema,
  Scope,
  Semaphore,
} from "effect"
import { Database } from "../database/database"
import { Schedule } from "../schedule"
import { makeGlobalNode } from "../effect/app-node"

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("Schedule.NotFoundError", {
  id: Schedule.ID,
}) {}

export { DaemonHeartbeatTable, ScheduleRunTable } from "./sql"
export { eq, lt } from "drizzle-orm"

export const PROCESS_INSTANCE_ID = randomUUID()
export const LEADER_TIMEOUT_MS = 45_000
export const HEARTBEAT_INTERVAL_MS = 15_000
export const TICK_INTERVAL_MS = 30_000
export const STARTUP_DELAY_SECONDS = 60
export const RUN_LEASE_GRACE_MS = 300_000
export const MAX_PAYLOAD_CHARS = 8_192 // Teto de 8 KB para campos textuais
export const RETENTION_DAYS_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

export function truncatePayload(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.length <= MAX_PAYLOAD_CHARS) return value
  return value.slice(0, MAX_PAYLOAD_CHARS) + `... [truncated at ${MAX_PAYLOAD_CHARS} chars]`
}

export const purgeOldRuns = Effect.fn("v2.Schedule.purgeOldRuns")(function* () {
  const schedules = yield* Schedule.Service
  yield* schedules.purgeRuns(Date.now() - RETENTION_DAYS_MS)
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

function leaseInput(ttlMs: number): Schedule.LeaseInput {
  return {
    ownerId: PROCESS_INSTANCE_ID,
    pid: process.pid,
    processTitle: process.title || "allcode",
    ttlMs,
  }
}

export const isLeader = Effect.fn("v2.Schedule.isLeader")(function* () {
  const schedules = yield* Schedule.Service
  if (yield* schedules.renewLease(leaseInput(LEADER_TIMEOUT_MS))) return true
  return yield* schedules.claimLease(leaseInput(LEADER_TIMEOUT_MS))
})

export const releaseLeader = Effect.fn("v2.Schedule.releaseLeader")(function* () {
  const schedules = yield* Schedule.Service
  yield* schedules.releaseLease(PROCESS_INSTANCE_ID)
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

interface ActionResult {
  readonly exitCode: number
  readonly error?: string
  readonly sessionId?: string
  readonly timedOut?: boolean
}

function resolveTimeoutMs(action: Schedule.Action): number {
  return "timeoutMs" in action && typeof action.timeoutMs === "number" && action.timeoutMs > 0
    ? action.timeoutMs
    : DEFAULT_TIMEOUT_MS
}

function executeCommand(
  command: string,
  cwd?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ exitCode: number; error?: string; timedOut?: boolean }> {
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
          resolve({ exitCode: 1, error: `timeout after ${timeoutMs}ms`, timedOut: true })
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
  const timeoutMs = resolveTimeoutMs(action)

  if (action.kind === "shell") {
    return Effect.promise(() => executeCommand(action.command, workspace, timeoutMs)).pipe(
      Effect.map((res) => ({
        exitCode: res.exitCode,
        error: res.error,
        sessionId: undefined,
        timedOut: res.timedOut,
      })),
    )
  }
  if (action.kind === "mcp_tool") {
    return Effect.gen(function* () {
      const caller = yield* McpCaller
      const result: McpCallResult & { timedOut?: boolean } = yield* caller.callTool(action.server, action.tool, action.args).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms`, timedOut: true }),
        }),
      )
      return { exitCode: result.success ? 0 : 1, error: result.error, sessionId: undefined, timedOut: result.timedOut }
    })
  }
  if (action.kind === "skill") {
    return Effect.gen(function* () {
      const caller = yield* SkillCaller
      const result: SkillCallResult & { timedOut?: boolean } = yield* caller.runSkill(action, workspace, sessionId).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms`, sessionId, timedOut: true }),
        }),
      )
      return {
        exitCode: result.success ? 0 : 1,
        error: result.error,
        sessionId: result.sessionId ?? sessionId,
        timedOut: result.timedOut,
      }
    })
  }
  if (action.kind === "agentui") {
    return Effect.gen(function* () {
      const caller = yield* AgentUICaller
      const result: AgentUICallResult & { timedOut?: boolean } = yield* caller.runAgent(action, workspace).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms`, timedOut: true }),
        }),
      )
      return { exitCode: result.success ? 0 : 1, error: result.error, sessionId: undefined, timedOut: result.timedOut }
    })
  }
  if (action.kind === "reminder") {
    return Effect.gen(function* () {
      const caller = yield* ReminderCaller
      const result: ReminderCallResult & { timedOut?: boolean } = yield* caller.notifyReminder(action, workspace).pipe(
        Effect.timeoutOrElse({
          duration: Duration.millis(timeoutMs),
          orElse: () => Effect.succeed({ success: false, error: `timeout after ${timeoutMs}ms`, timedOut: true }),
        }),
      )
      return { exitCode: result.success ? 0 : 1, error: result.error, sessionId: undefined, timedOut: result.timedOut }
    })
  }
  return Effect.succeed({
    exitCode: 1,
    error: `Action kind "${(action as { readonly kind: string }).kind}" is not yet supported by the schedule runner.`,
    sessionId: undefined,
    timedOut: false,
  })
}

/** Runs an action with 1 immediate courtesy retry on failure. Timeouts are not retried. */
function runActionWithRetry(action: Schedule.Action, workspace: string | undefined, sessionId?: string) {
  return Effect.gen(function* () {
    const firstAttempt = yield* runAction(action, workspace, sessionId)
    if (firstAttempt.exitCode === 0 || firstAttempt.timedOut) {
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

interface RunOutcome {
  readonly status: Schedule.RunStatus
  readonly error?: string
  readonly sessionId?: string
}

function classify(exit: Exit.Exit<ActionResult>, fallbackSessionId?: string): RunOutcome {
  if (Exit.isSuccess(exit)) {
    const result = exit.value
    const status: Schedule.RunStatus = result.timedOut ? "timeout" : result.exitCode === 0 ? "success" : "error"
    return { status, error: result.error, sessionId: result.sessionId ?? fallbackSessionId }
  }
  if (Cause.hasInterruptsOnly(exit.cause)) {
    return {
      status: "cancelled",
      error: "Execução cancelada (interrupção do scheduler)",
      sessionId: fallbackSessionId,
    }
  }
  return { status: "error", error: Cause.pretty(exit.cause), sessionId: fallbackSessionId }
}

const executeAndFinalize = Effect.fnUntraced(function* (
  schedule: Schedule.Info,
  run: Schedule.StartRunResult,
  trigger: Schedule.RunTrigger,
) {
  const schedules = yield* Schedule.Service
  const exit = yield* Effect.exit(runActionWithRetry(schedule.action, schedule.workspace, schedule.lastSessionId))
  const outcome = classify(exit, schedule.lastSessionId)
  const durationMs = Date.now() - run.startedAt

  yield* schedules.finishRun({
    runId: run.id,
    scheduleId: schedule.id,
    startedAt: run.startedAt,
    status: outcome.status,
    error: truncatePayload(outcome.error),
    sessionId: outcome.sessionId,
    durationMs,
  })

  if (outcome.status === "success") {
    yield* Effect.logInfo(`[Schedule] Task ${schedule.id} completed successfully`, {
      runId: run.id,
      trigger,
      durationMs,
    })
  } else {
    yield* Effect.logWarning(`[Schedule] Task ${schedule.id} finished with ${outcome.status}`, {
      runId: run.id,
      trigger,
      error: outcome.error,
      durationMs,
    })
  }

  return outcome
})

/** Runs one schedule's action immediately, regardless of trigger/enabled state, and records the result. */
export const runOne = Effect.fn("v2.Schedule.runOne")(function* (id: Schedule.ID) {
  const schedules = yield* Schedule.Service
  const schedule = yield* schedules.get(id)
  if (!schedule) return yield* Effect.fail(new NotFoundError({ id }))

  const startedAt = Date.now()
  const timeoutMs = resolveTimeoutMs(schedule.action)
  const run = yield* schedules.startRun({
    scheduleId: id,
    trigger: "manual",
    scheduledFor: startedAt,
    claimedBy: PROCESS_INSTANCE_ID,
    leaseUntil: startedAt + timeoutMs * 2 + RUN_LEASE_GRACE_MS,
    disableSchedule: schedule.trigger.kind === "once",
  })
  if (!run) {
    yield* Effect.logWarning(`[Schedule] Task ${id} already running, skipping manual trigger`)
    return (yield* schedules.get(id))!
  }

  yield* executeAndFinalize(schedule, run, "manual")
  return (yield* schedules.get(id))!
})

export const tick = Effect.fn("v2.Schedule.tick")(function* (scope: Scope.Scope) {
  const schedules = yield* Schedule.Service
  if (!(yield* isLeader())) return

  const now = new Date()
  const nowMs = now.getTime()

  yield* schedules.failStaleRuns(nowMs, "Execução interrompida (lease expirado ou scheduler reiniciado)").pipe(
    Effect.tap((count) =>
      count > 0
        ? Effect.logWarning(`[Schedule] ${count} execução(ões) órfã(s) marcada(s) como erro`)
        : Effect.void,
    ),
    Effect.ignore,
  )

  const due: Array<{ schedule: Schedule.Info; trigger: Schedule.RunTrigger }> = []

  for (const schedule of yield* schedules.list()) {
    if (!schedule.enabled) continue
    if (schedule.trigger.kind === "manual") continue

    if (schedule.trigger.kind === "once") {
      if (schedule.lastRunAt || nowMs < schedule.trigger.timestamp) continue
      due.push({ schedule, trigger: "once" })
      continue
    }

    if (schedule.trigger.kind === "interval") {
      if (schedule.lastRunAt && nowMs - schedule.lastRunAt < schedule.trigger.ms) continue
      due.push({ schedule, trigger: "interval" })
      continue
    }

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
    due.push({ schedule, trigger: missedWhileOffline && !matchesNow ? "catchup" : "cron" })
  }

  // Claim rápido (sequencial) e disparo da ação em fiber própria. O tick nunca
  // espera a ação terminar, então heartbeat e outras rotinas continuam vivos.
  yield* Effect.forEach(
    due,
    ({ schedule, trigger }) =>
      Effect.gen(function* () {
        const startedAt = Date.now()
        const timeoutMs = resolveTimeoutMs(schedule.action)
        const run = yield* schedules.startRun({
          scheduleId: schedule.id,
          trigger,
          scheduledFor: startedAt,
          claimedBy: PROCESS_INSTANCE_ID,
          leaseUntil: startedAt + timeoutMs * 2 + RUN_LEASE_GRACE_MS,
          disableSchedule: schedule.trigger.kind === "once",
        })
        if (!run) {
          yield* Effect.logInfo(`[Schedule] Task ${schedule.id} already running, skipping`, { trigger })
          return
        }

        yield* withActionPermit(schedule.action, executeAndFinalize(schedule, run, trigger)).pipe(
          Effect.catchCause((cause) =>
            Effect.logError(`[Schedule] Unhandled execution failure for ${schedule.id}`, {
              runId: run.id,
              cause,
            }),
          ),
          Effect.forkIn(scope),
        )
      }),
    { concurrency: 1 },
  )

  // Auto-purge de histórico com mais de 7 dias
  yield* purgeOldRuns().pipe(Effect.ignore)
})

const heartbeatLoop = isLeader().pipe(
  Effect.catchCause((cause) => Effect.logWarning(`[Schedule] Heartbeat failed, retrying...`, { cause })),
  Effect.repeat(EffectSchedule.spaced(Duration.millis(HEARTBEAT_INTERVAL_MS))),
)

const tickLoop = (scope: Scope.Scope) =>
  tick(scope).pipe(
    Effect.catchCause((cause) =>
      Effect.gen(function* () {
        yield* Effect.logWarning(`[Schedule] Tick loop encountered unexpected error, recovering...`, { cause })
        yield* Effect.sleep(Duration.seconds(5))
      }),
    ),
    Effect.repeat(EffectSchedule.spaced(Duration.millis(TICK_INTERVAL_MS))),
  )

const tickLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const scope = yield* Effect.scope

    // Heartbeat independente do tick: mantém a liderança mesmo com ações longas.
    yield* heartbeatLoop.pipe(Effect.forkIn(scope))

    yield* Effect.sleep(Duration.seconds(STARTUP_DELAY_SECONDS))
    yield* tickLoop(scope).pipe(Effect.forkIn(scope))
  }),
)

export const tickNode = makeGlobalNode({
  name: "schedule-tick",
  layer: Layer.merge(Schedule.layer, tickLayer.pipe(Layer.provide(Schedule.layer))),
  deps: [Database.node, Schedule.node, mcpCallerNode, skillCallerNode, agentUICallerNode, reminderCallerNode],
})
