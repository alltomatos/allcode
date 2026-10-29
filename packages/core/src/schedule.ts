export * as Schedule from "./schedule"

import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Schedule } from "@allcode/schema/schedule"
import { Database } from "./database/database"
import { EventV2 } from "./event"
import { makeGlobalNode } from "./effect/app-node"
import { DaemonHeartbeatTable, ScheduleRunTable, ScheduleTable } from "./schedule/sql"

export const ID = Schedule.ID
export type ID = Schedule.ID

export const Event = Schedule.Event

export const RunID = Schedule.RunID
export type RunID = Schedule.RunID

export const RunStatus = Schedule.RunStatus
export type RunStatus = Schedule.RunStatus

export const RunTrigger = Schedule.RunTrigger
export type RunTrigger = Schedule.RunTrigger

export const Trigger = Schedule.Trigger
export type Trigger = Schedule.Trigger

export const Action = Schedule.Action
export type Action = Schedule.Action

export const SkillAction = Schedule.SkillAction
export type SkillAction = Schedule.SkillAction

export const McpToolAction = Schedule.McpToolAction
export type McpToolAction = Schedule.McpToolAction

export const AgentUIAction = Schedule.AgentUIAction
export type AgentUIAction = Schedule.AgentUIAction

export const ReminderAction = Schedule.ReminderAction
export type ReminderAction = Schedule.ReminderAction

export const OnceTrigger = Schedule.OnceTrigger
export type OnceTrigger = Schedule.OnceTrigger

export const ShellAction = Schedule.ShellAction
export type ShellAction = Schedule.ShellAction

export class Info extends Schema.Class<Info>("v2.Schedule.Info")({
  id: ID,
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  trigger: Trigger,
  action: Action,
  workspace: Schema.optional(Schema.String),
  enabled: Schema.Boolean,
  lastRunAt: Schema.optional(Schema.Number),
  lastStatus: Schema.optional(Schema.Literals(["success", "error"])),
  lastError: Schema.optional(Schema.String),
  lastSessionId: Schema.optional(Schema.String),
  idempotencyKey: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
}) {}

export interface CreateInput {
  readonly name?: string
  readonly description?: string
  readonly trigger: Trigger
  readonly action: Action
  readonly workspace?: string
  readonly enabled?: boolean
  readonly idempotencyKey?: string
  readonly metadata?: Record<string, unknown>
}

export interface RunRecord {
  readonly id: RunID
  readonly scheduleId: ID
  readonly startedAt: number
  readonly durationMs: number
  readonly status: RunStatus
  readonly attempt: number
  readonly error?: string
  readonly sessionId?: string
  readonly finishedAt?: number
  readonly trigger?: RunTrigger
  readonly scheduledFor?: number
  readonly claimedBy?: string
  readonly leaseUntil?: number
  readonly heartbeatAt?: number
}

export interface SchedulerHeartbeat {
  readonly instanceId: string
  readonly pid: number
  readonly processTitle: string
  readonly lastSeen: number
  readonly ownerId?: string
  readonly leaseUntil?: number
}

export interface UpdateInput {
  readonly name?: string
  readonly description?: string
  readonly trigger?: Trigger
  readonly action?: Action
  readonly workspace?: string
  readonly enabled?: boolean
  readonly lastRunAt?: number
  readonly lastStatus?: "success" | "error"
  readonly lastError?: string | null
  readonly lastSessionId?: string
  readonly metadata?: Record<string, unknown>
}

export interface StartRunInput {
  readonly scheduleId: ID
  readonly trigger: RunTrigger
  readonly scheduledFor?: number
  readonly attempt?: number
  readonly claimedBy: string
  readonly leaseUntil?: number
  readonly disableSchedule?: boolean
}

export interface StartRunResult {
  readonly id: RunID
  readonly startedAt: number
}

export interface FinishRunInput {
  readonly runId: RunID
  readonly scheduleId: ID
  readonly startedAt: number
  readonly status: RunStatus
  readonly error?: string
  readonly sessionId?: string
  readonly durationMs: number
  readonly finishedAt?: number
}

export interface LeaseInput {
  readonly ownerId: string
  readonly pid: number
  readonly processTitle: string
  readonly ttlMs: number
}

export const LEASE_ROW_ID = "scheduler"
const DEFAULT_RUN_LEASE_MS = 31 * 60_000

export class InvalidCronError extends Schema.TaggedErrorClass<InvalidCronError>()("Schedule.InvalidCronError", {
  message: Schema.String,
}) {}

export class InvalidCommandError extends Schema.TaggedErrorClass<InvalidCommandError>()(
  "Schedule.InvalidCommandError",
  { message: Schema.String },
) {}

function matchCronPart(part: string, value: number, min: number): boolean {
  if (part === "*") return true
  if (part.startsWith("*/")) {
    const step = parseInt(part.slice(2), 10)
    if (isNaN(step) || step <= 0) return false
    return (value - min) % step === 0
  }
  if (part.includes(",")) {
    return part.split(",").some((sub) => matchCronPart(sub.trim(), value, min))
  }
  if (part.includes("-")) {
    const [startStr, endStr] = part.split("-")
    const start = parseInt(startStr, 10)
    const end = parseInt(endStr, 10)
    if (isNaN(start) || isNaN(end)) return false
    return value >= start && value <= end
  }
  const num = parseInt(part, 10)
  return !isNaN(num) && num === value
}

export function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const limits: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ]
  return parts.every((part, idx) => {
    const [min, max] = limits[idx]
    if (part === "*") return true
    if (part.startsWith("*/")) {
      const step = parseInt(part.slice(2), 10)
      return !isNaN(step) && step > 0 && step <= max
    }
    if (part.includes(",")) {
      return part.split(",").every((sub) => {
        const n = parseInt(sub.trim(), 10)
        return !isNaN(n) && n >= min && n <= max
      })
    }
    if (part.includes("-")) {
      const [s, e] = part.split("-")
      const start = parseInt(s, 10)
      const end = parseInt(e, 10)
      return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end
    }
    const n = parseInt(part, 10)
    return !isNaN(n) && n >= min && n <= max
  })
}

export function matchesCron(cron: string, date: Date = new Date()): boolean {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const minute = date.getMinutes()
  const hour = date.getHours()
  const dayOfMonth = date.getDate()
  const month = date.getMonth() + 1
  const dayOfWeek = date.getDay()

  if (!matchCronPart(parts[0], minute, 0)) return false
  if (!matchCronPart(parts[1], hour, 0)) return false
  if (!matchCronPart(parts[3], month, 1)) return false

  const domPart = parts[2]
  const dowPart = parts[4]
  const domRestricted = domPart !== "*"
  const dowRestricted = dowPart !== "*"
  const domMatch = matchCronPart(domPart, dayOfMonth, 1)
  const dowMatch = matchCronPart(dowPart, dayOfWeek, 0) || (dayOfWeek === 0 && matchCronPart(dowPart, 7, 0))

  if (domRestricted && dowRestricted) {
    if (!domMatch && !dowMatch) return false
  } else {
    if (domRestricted && !domMatch) return false
    if (dowRestricted && !dowMatch) return false
  }

  return true
}

/**
 * Checks if a cron expression was scheduled to run at least once between fromMs and toMs (inclusive of minutes).
 * Used for detecting missed cron schedules (misfires) when the computer was turned off or process was closed.
 */
export function hasCronRunBetween(cron: string, fromMs: number, toMs: number): boolean {
  if (fromMs >= toMs) return false
  if (!isValidCron(cron)) return false

  // Truncate to minute boundaries
  const startMinute = Math.floor(fromMs / 60_000) * 60_000 + 60_000
  const endMinute = Math.floor(toMs / 60_000) * 60_000

  // Cap lookback window to prevent excessive iteration (e.g. max 7 days = 10080 minutes)
  const maxLookbackMs = 7 * 24 * 60 * 60_000
  const effectiveStartMinute = Math.max(startMinute, endMinute - maxLookbackMs)

  for (let t = effectiveStartMinute; t <= endMinute; t += 60_000) {
    if (matchesCron(cron, new Date(t))) {
      return true
    }
  }

  return false
}

export interface Interface {
  readonly list: () => Effect.Effect<Info[]>
  readonly get: (id: ID) => Effect.Effect<Info | undefined>
  readonly create: (input: CreateInput) => Effect.Effect<Info, InvalidCronError | InvalidCommandError>
  readonly update: (id: ID, updates: UpdateInput) => Effect.Effect<Info | undefined>
  readonly remove: (id: ID) => Effect.Effect<void>
  readonly startRun: (input: StartRunInput) => Effect.Effect<StartRunResult | undefined>
  readonly finishRun: (input: FinishRunInput) => Effect.Effect<void>
  readonly runs: (scheduleId: ID, limit?: number) => Effect.Effect<RunRecord[]>
  readonly latestRun: (scheduleId: ID) => Effect.Effect<RunRecord | undefined>
  readonly heartbeatRun: (runId: RunID, now?: number) => Effect.Effect<void>
  readonly abortRun: (runId: RunID, now: number, message: string) => Effect.Effect<boolean>
  readonly schedulerHeartbeat: () => Effect.Effect<SchedulerHeartbeat | undefined>
  readonly failStaleRuns: (now: number, message: string) => Effect.Effect<number>
  readonly claimLease: (input: LeaseInput) => Effect.Effect<boolean>
  readonly renewLease: (input: LeaseInput) => Effect.Effect<boolean>
  readonly releaseLease: (ownerId: string) => Effect.Effect<void>
  readonly purgeRuns: (before: number) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Schedule") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* Database.Service
    const events = yield* EventV2.Service

    const stored = (row: typeof ScheduleTable.$inferSelect) =>
      new Info({
        id: row.id,
        name: row.name ?? undefined,
        description: row.description ?? undefined,
        trigger: row.trigger,
        action: row.action,
        workspace: row.workspace ?? undefined,
        enabled: row.enabled,
        lastRunAt: row.last_run_at ?? undefined,
        lastStatus: row.last_status ?? undefined,
        lastError: row.last_error ?? undefined,
        lastSessionId: row.last_session_id ?? undefined,
        idempotencyKey: row.idempotency_key ?? undefined,
        metadata: row.metadata ?? undefined,
      })

    const storedRun = (row: typeof ScheduleRunTable.$inferSelect): RunRecord => ({
      id: RunID.make(row.id),
      scheduleId: ID.make(row.schedule_id),
      startedAt: row.started_at,
      durationMs: row.duration_ms,
      status: row.status,
      attempt: row.attempt,
      error: row.error ?? undefined,
      sessionId: row.session_id ?? undefined,
      finishedAt: row.finished_at ?? undefined,
      trigger: row.trigger_source ?? undefined,
      scheduledFor: row.scheduled_for ?? undefined,
      claimedBy: row.claimed_by ?? undefined,
      leaseUntil: row.lease_until ?? undefined,
      heartbeatAt: row.heartbeat_at ?? undefined,
    })

    return Service.of({
      list: Effect.fn("v2.Schedule.list")(function* () {
        return (
          yield* db.select().from(ScheduleTable).orderBy(asc(ScheduleTable.time_created)).all().pipe(Effect.orDie)
        ).map(stored)
      }),
      get: Effect.fn("v2.Schedule.get")(function* (id) {
        const row = yield* db.select().from(ScheduleTable).where(eq(ScheduleTable.id, id)).get().pipe(Effect.orDie)
        return row ? stored(row) : undefined
      }),
      create: Effect.fn("v2.Schedule.create")(function* (input) {
        let trigger = input.trigger
        if (trigger.kind === "cron") {
          const expr = trigger.expr.trim()
          if (!isValidCron(expr)) {
            return yield* Effect.fail(
              new InvalidCronError({
                message: `Invalid cron expression: "${trigger.expr}". Expected 5 fields (e.g. '*/5 * * * *')`,
              }),
            )
          }
          trigger = { kind: "cron", expr }
        }

        let action = input.action
        if (action.kind === "shell") {
          const command = action.command.trim()
          if (!command) {
            return yield* Effect.fail(new InvalidCommandError({ message: "Command cannot be empty" }))
          }
          action = { kind: "shell", command, timeoutMs: action.timeoutMs }
        }

        if (input.idempotencyKey) {
          const existing = yield* db
            .select()
            .from(ScheduleTable)
            .where(eq(ScheduleTable.idempotency_key, input.idempotencyKey))
            .get()
            .pipe(Effect.orDie)
          if (existing) return stored(existing)
        }

        const info = new Info({
          id: ID.create(),
          name: input.name,
          description: input.description,
          trigger,
          action,
          workspace: input.workspace,
          enabled: input.enabled ?? true,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata,
        })
        yield* db
          .insert(ScheduleTable)
          .values({
            id: info.id,
            name: info.name,
            description: info.description,
            trigger: info.trigger,
            action: info.action,
            workspace: info.workspace,
            enabled: info.enabled,
            idempotency_key: info.idempotencyKey,
            metadata: info.metadata,
          })
          .onConflictDoNothing()
          .run()
          .pipe(Effect.orDie)

        const row = yield* db
          .select()
          .from(ScheduleTable)
          .where(
            input.idempotencyKey
              ? eq(ScheduleTable.idempotency_key, input.idempotencyKey)
              : eq(ScheduleTable.id, info.id),
          )
          .get()
          .pipe(Effect.orDie)
        const created = row ? stored(row) : info
        yield* events.publish(Event.Created, { id: created.id })
        return created
      }),
      update: Effect.fn("v2.Schedule.update")(function* (id, updates) {
        yield* db
          .update(ScheduleTable)
          .set({
            name: updates.name,
            description: updates.description,
            trigger: updates.trigger,
            action: updates.action,
            workspace: updates.workspace,
            enabled: updates.enabled,
            last_run_at: updates.lastRunAt,
            last_status: updates.lastStatus,
            last_error: updates.lastError,
            last_session_id: updates.lastSessionId,
            ...(updates.metadata !== undefined ? { metadata: updates.metadata } : {}),
          })
          .where(eq(ScheduleTable.id, id))
          .run()
          .pipe(Effect.orDie)
        const row = yield* db.select().from(ScheduleTable).where(eq(ScheduleTable.id, id)).get().pipe(Effect.orDie)
        if (!row) return undefined
        yield* events.publish(Event.Updated, { id })
        return stored(row)
      }),
      remove: Effect.fn("v2.Schedule.remove")(function* (id) {
        const existing = yield* db
          .select({ id: ScheduleTable.id })
          .from(ScheduleTable)
          .where(eq(ScheduleTable.id, id))
          .get()
          .pipe(Effect.orDie)
        yield* db.delete(ScheduleTable).where(eq(ScheduleTable.id, id)).run().pipe(Effect.orDie)
        if (existing) yield* events.publish(Event.Deleted, { id })
      }),
      startRun: Effect.fn("v2.Schedule.startRun")(function* (input) {
        const startedAt = Date.now()
        const runID = Schedule.RunID.create()
        const leaseUntil = input.leaseUntil ?? startedAt + DEFAULT_RUN_LEASE_MS
        return yield* db
          .transaction((tx) =>
            Effect.gen(function* () {
              // Uma rotina só pode ter uma execução ativa por vez. A transação
              // serializa o claim para evitar sobreposição entre tick e "Rodar agora".
              const active = yield* tx
                .select({ id: ScheduleRunTable.id })
                .from(ScheduleRunTable)
                .where(
                  and(
                    eq(ScheduleRunTable.schedule_id, input.scheduleId),
                    eq(ScheduleRunTable.status, "running"),
                    gt(ScheduleRunTable.lease_until, startedAt),
                  ),
                )
                .get()
              if (active) return undefined

              yield* tx
                .insert(ScheduleRunTable)
                .values({
                  id: runID,
                  schedule_id: input.scheduleId,
                  started_at: startedAt,
                  duration_ms: 0,
                  status: "running",
                  error: null,
                  session_id: null,
                  finished_at: null,
                  trigger_source: input.trigger,
                  attempt: input.attempt ?? 1,
                  scheduled_for: input.scheduledFor ?? null,
                  claimed_by: input.claimedBy,
                  lease_until: leaseUntil,
                  heartbeat_at: startedAt,
                })
                .run()

              // Marca last_run_at já no claim: evita que o próximo tick
              // selecione novamente a mesma rotina enquanto ela executa.
              // Update cru para não bumpar time_updated (edição do usuário).
              yield* tx.run(sql`
                UPDATE schedule
                SET last_run_at = ${startedAt},
                    enabled = CASE WHEN ${input.disableSchedule ? 1 : 0} = 1 THEN 0 ELSE enabled END
                WHERE id = ${input.scheduleId}
              `)

              return { id: runID, startedAt }
            }),
          )
          .pipe(Effect.orDie)
      }),
      finishRun: Effect.fn("v2.Schedule.finishRun")(function* (input) {
        const finishedAt = input.finishedAt ?? Date.now()
        yield* db
          .transaction((tx) =>
            Effect.gen(function* () {
              // A restart may have already cancelled this run. A late fiber
              // must not resurrect it or overwrite the denormalized schedule
              // state that the new run now owns.
              const active = yield* tx
                .select({ id: ScheduleRunTable.id })
                .from(ScheduleRunTable)
                .where(
                  and(eq(ScheduleRunTable.id, input.runId), eq(ScheduleRunTable.status, "running")),
                )
                .get()
              if (!active) return false

              yield* tx
                .update(ScheduleRunTable)
                .set({
                  status: input.status,
                  error: input.error ?? null,
                  session_id: input.sessionId ?? null,
                  duration_ms: input.durationMs,
                  finished_at: finishedAt,
                  lease_until: null,
                })
                .where(
                  and(eq(ScheduleRunTable.id, input.runId), eq(ScheduleRunTable.status, "running")),
                )
                .run()

              // Cache denormalizado para a UI. timeout/cancelled/skipped viram "error".
              yield* tx.run(sql`
                UPDATE schedule
                SET last_run_at = ${input.startedAt},
                    last_status = ${input.status === "success" ? "success" : "error"},
                    last_error = ${input.error ?? null},
                    last_session_id = ${input.sessionId ?? null}
                WHERE id = ${input.scheduleId}
              `)
              return true
            }),
          )
          .pipe(Effect.orDie)
      }),
      runs: Effect.fn("v2.Schedule.runs")(function* (scheduleId, limit = 20) {
        const rows = yield* db
          .select()
          .from(ScheduleRunTable)
          .where(eq(ScheduleRunTable.schedule_id, scheduleId))
          .orderBy(desc(ScheduleRunTable.started_at))
          .limit(limit)
          .all()
          .pipe(Effect.orDie)
        return rows.map(storedRun)
      }),
      latestRun: Effect.fn("v2.Schedule.latestRun")(function* (scheduleId) {
        const row = yield* db
          .select()
          .from(ScheduleRunTable)
          .where(eq(ScheduleRunTable.schedule_id, scheduleId))
          .orderBy(desc(ScheduleRunTable.started_at))
          .limit(1)
          .get()
          .pipe(Effect.orDie)
        return row ? storedRun(row) : undefined
      }),
      heartbeatRun: Effect.fn("v2.Schedule.heartbeatRun")(function* (runId, now = Date.now()) {
        yield* db
          .update(ScheduleRunTable)
          .set({ heartbeat_at: now })
          .where(and(eq(ScheduleRunTable.id, runId), eq(ScheduleRunTable.status, "running")))
          .run()
          .pipe(Effect.orDie)
      }),
      abortRun: Effect.fn("v2.Schedule.abortRun")(function* (runId, now, message) {
        const active = yield* db
          .select({ id: ScheduleRunTable.id })
          .from(ScheduleRunTable)
          .where(and(eq(ScheduleRunTable.id, runId), eq(ScheduleRunTable.status, "running")))
          .get()
          .pipe(Effect.orDie)
        if (!active) return false
        yield* db.run(sql`
          UPDATE schedule_run
          SET status = 'cancelled',
              error = ${message},
              finished_at = ${now},
              duration_ms = ${now} - started_at,
              lease_until = NULL
          WHERE id = ${runId}
            AND status = 'running'
        `).pipe(Effect.orDie)
        return true
      }),
      schedulerHeartbeat: Effect.fn("v2.Schedule.schedulerHeartbeat")(function* () {
        const row = yield* db
          .select()
          .from(DaemonHeartbeatTable)
          .where(eq(DaemonHeartbeatTable.instance_id, LEASE_ROW_ID))
          .get()
          .pipe(Effect.orDie)
        if (!row) return undefined
        return {
          instanceId: row.instance_id,
          pid: row.pid,
          processTitle: row.process_title,
          lastSeen: row.last_seen,
          ownerId: row.owner_id ?? undefined,
          leaseUntil: row.lease_until ?? undefined,
        }
      }),
      failStaleRuns: Effect.fn("v2.Schedule.failStaleRuns")(function* (now, message) {
        const stale = yield* db
          .select({ id: ScheduleRunTable.id, schedule_id: ScheduleRunTable.schedule_id })
          .from(ScheduleRunTable)
          .where(
            and(
              eq(ScheduleRunTable.status, "running"),
              lt(ScheduleRunTable.lease_until, now),
            ),
          )
          .all()
          .pipe(Effect.orDie)
        if (stale.length === 0) return 0

        yield* db.run(sql`
          UPDATE schedule_run
          SET status = 'error',
              error = ${message},
              finished_at = ${now},
              duration_ms = ${now} - started_at,
              lease_until = NULL
          WHERE status = 'running'
            AND lease_until IS NOT NULL
            AND lease_until < ${now}
        `).pipe(Effect.orDie)

        // Atualiza o cache denormalizado exibido pela UI sem tocar time_updated.
        for (const scheduleId of new Set(stale.map((row) => row.schedule_id))) {
          yield* db.run(sql`
            UPDATE schedule
            SET last_status = 'error',
                last_error = ${message}
            WHERE id = ${scheduleId}
          `).pipe(Effect.orDie)
        }
        return stale.length
      }),
      claimLease: Effect.fn("v2.Schedule.claimLease")(function* (input) {
        const now = Date.now()
        const leaseUntil = now + input.ttlMs
        yield* db.run(sql`
          INSERT INTO daemon_heartbeat (instance_id, pid, process_title, last_seen, owner_id, lease_until)
          VALUES (${LEASE_ROW_ID}, ${input.pid}, ${input.processTitle}, ${now}, ${input.ownerId}, ${leaseUntil})
          ON CONFLICT(instance_id) DO UPDATE SET
            owner_id = excluded.owner_id,
            pid = excluded.pid,
            process_title = excluded.process_title,
            last_seen = excluded.last_seen,
            lease_until = excluded.lease_until
          WHERE daemon_heartbeat.owner_id IS NULL
             OR daemon_heartbeat.owner_id = excluded.owner_id
             OR daemon_heartbeat.lease_until IS NULL
             OR daemon_heartbeat.lease_until < ${now}
        `).pipe(Effect.orDie)

        const row = yield* db
          .select()
          .from(DaemonHeartbeatTable)
          .where(eq(DaemonHeartbeatTable.instance_id, LEASE_ROW_ID))
          .get()
          .pipe(Effect.orDie)
        return row?.owner_id === input.ownerId
      }),
      renewLease: Effect.fn("v2.Schedule.renewLease")(function* (input) {
        const now = Date.now()
        const leaseUntil = now + input.ttlMs
        yield* db.run(sql`
          UPDATE daemon_heartbeat
          SET last_seen = ${now},
              lease_until = ${leaseUntil},
              pid = ${input.pid},
              process_title = ${input.processTitle}
          WHERE instance_id = ${LEASE_ROW_ID}
            AND owner_id = ${input.ownerId}
        `).pipe(Effect.orDie)

        const row = yield* db
          .select()
          .from(DaemonHeartbeatTable)
          .where(eq(DaemonHeartbeatTable.instance_id, LEASE_ROW_ID))
          .get()
          .pipe(Effect.orDie)
        return row?.owner_id === input.ownerId
      }),
      releaseLease: Effect.fn("v2.Schedule.releaseLease")(function* (ownerId) {
        yield* db.run(sql`
          UPDATE daemon_heartbeat
          SET owner_id = NULL,
              lease_until = NULL
          WHERE instance_id = ${LEASE_ROW_ID}
            AND owner_id = ${ownerId}
        `).pipe(Effect.orDie)
      }),
      purgeRuns: Effect.fn("v2.Schedule.purgeRuns")(function* (before) {
        yield* db
          .delete(ScheduleRunTable)
          .where(lt(ScheduleRunTable.started_at, before))
          .run()
          .pipe(Effect.orDie)
      }),
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node, EventV2.node] })
