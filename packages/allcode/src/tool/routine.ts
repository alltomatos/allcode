import { Cause, Effect } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./routine.txt"
import { Schedule } from "@allcode/core/schedule"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { ScheduleHealth } from "@allcode/core/schedule/health"
import { Storage } from "@/storage/storage"
import {
  buildCreatePlan,
  fail,
  ok,
  Parameters,
  sameRoutineKey,
  type Envelope,
  type ErrorCode,
  type Parameters as RoutineParameters,
} from "./routine-schema"

export { Parameters }

const AUDIT_LIMIT = 50

interface AuditEntry {
  readonly id: string
  readonly timestamp: number
  readonly action: "create" | "status" | "restart"
  readonly actor: string
  readonly sessionID?: string
  readonly callID?: string
  readonly routineId?: string
  readonly previousState?: string
  readonly result: string
  readonly details?: Record<string, unknown>
}

const auditKey = (routineId: string) => ["schedule", "audit", routineId]

const iso = (value: number | undefined) => (value === undefined ? undefined : new Date(value).toISOString())

type RoutineMetadata = {
  [key: string]: unknown
  ok?: boolean
  code?: ErrorCode
  routineId?: string
  field?: unknown
  state?: string
  previousState?: string
}

type RoutineResult = {
  title: string
  output: string
  metadata: RoutineMetadata
}

function result<T>(
  title: string,
  value: Envelope<T>,
  metadata: RoutineMetadata = {},
): RoutineResult {
  return {
    title,
    output: JSON.stringify(value, null, 2),
    metadata: {
      ok: value.ok,
      ...(value.ok ? {} : { code: value.error.code }),
      ...metadata,
    },
  }
}

function failure(title: string, envelope: Envelope<never>, metadata: RoutineMetadata = {}): RoutineResult {
  return result(title, envelope, metadata)
}

const appendAudit = (storage: Storage.Interface, entry: AuditEntry) =>
  Effect.gen(function* () {
    const key = auditKey(entry.routineId ?? "global")
    const existing = yield* storage
      .read<AuditEntry[]>(key)
      .pipe(Effect.catch(() => Effect.succeed([] as AuditEntry[])))
    yield* storage.write(key, [entry, ...existing].slice(0, AUDIT_LIMIT))
  })

const permit = (
  ctx: Tool.Context,
  permission: "routine" | "routine_restart",
  patterns: string[],
  always: string[],
  metadata: Record<string, unknown>,
) =>
  ctx
    .ask({ permission, patterns, always, metadata })
    .pipe(Effect.as(true), Effect.catch(() => Effect.succeed(false)))

export const RoutineTool = Tool.define(
  "routine",
  Effect.gen(function* () {
    const schedules = yield* Schedule.Service
    const storage = yield* Storage.Service

    const audit = (entry: Omit<AuditEntry, "id" | "timestamp">) =>
      appendAudit(storage, { ...entry, id: crypto.randomUUID(), timestamp: Date.now() }).pipe(
        Effect.catchCause((cause) => Effect.logWarning("routine audit write failed", { cause })),
        Effect.asVoid,
      )

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: RoutineParameters, ctx: Tool.Context): Effect.Effect<RoutineResult> =>
        Effect.gen(function* () {
          if (params.action !== "restart") {
            const allowed = yield* permit(ctx, "routine", ["*"], ["*"], { action: params.action })
            if (!allowed) {
              return failure("Permissão negada", fail("PERMISSION_DENIED", "A rotina não foi autorizada."))
            }
          }

          if (params.action === "list") {
            const list = yield* schedules.list()
            const routines = list.map((r) => ({
              id: r.id,
              name: r.name ?? "(Sem nome)",
              description: r.description ?? "",
              trigger: r.trigger,
              actionKind: r.action.kind,
              enabled: r.enabled,
              lastStatus: r.lastStatus,
              lastRunAt: r.lastRunAt ? new Date(r.lastRunAt).toISOString() : undefined,
            }))

            return {
              title: "Lista de Rotinas",
              output: JSON.stringify(routines, null, 2),
              metadata: {},
            }
          }

          if (params.action === "get") {
            if (!params.routineId) {
              return failure(
                "Erro ao obter rotina",
                fail("INVALID_INPUT", "O parâmetro 'routineId' é obrigatório para a ação 'get'.", {
                  field: "routineId",
                }),
              )
            }
            const found = yield* schedules.get(Schedule.ID.make(params.routineId))
            if (!found) {
              return failure(
                "Rotina não encontrada",
                fail("ROUTINE_NOT_FOUND", `Rotina '${params.routineId}' não foi encontrada.`, {
                  routineId: params.routineId,
                }),
              )
            }
            return {
              title: `Rotina: ${found.name ?? found.id}`,
              output: JSON.stringify(found, null, 2),
              metadata: { routineId: found.id },
            }
          }

          if (params.action === "create") {
            const plan = buildCreatePlan(params)
            if (!plan.ok) {
              return failure("Rotina inválida", plan, { field: plan.error.details?.field })
            }

            const list = yield* schedules.list()
            const idempotent = plan.data.idempotencyKey
              ? list.find((routine) => routine.idempotencyKey === plan.data.idempotencyKey)
              : undefined
            if (idempotent) {
              return result(
                "Rotina já existente",
                ok({
                  routineId: idempotent.id,
                  status: "existing",
                  enabled: idempotent.enabled,
                }),
                { routineId: idempotent.id },
              )
            }

            const duplicate = list.find((routine) => sameRoutineKey(routine, plan.data.name, plan.data.trigger))
            if (duplicate) {
              return failure(
                "Rotina duplicada",
                fail("ROUTINE_DUPLICATE", "Já existe uma rotina com o mesmo nome e agendamento.", {
                  existingId: duplicate.id,
                  name: plan.data.name,
                }),
                { routineId: duplicate.id },
              )
            }

            const created = yield* schedules.create({
              name: plan.data.name,
              description: plan.data.description,
              trigger: plan.data.trigger,
              action: plan.data.action,
              workspace: plan.data.workspace,
              enabled: plan.data.enabled,
              idempotencyKey: plan.data.idempotencyKey,
              metadata: plan.data.metadata,
            }).pipe(
              Effect.map((routine) => ok({ routineId: routine.id, status: "created" as const })),
              Effect.catchTag("Schedule.InvalidCronError", (error) =>
                Effect.succeed(fail("INVALID_CRON", error.message, { field: "schedule.expr" })),
              ),
              Effect.catchTag("Schedule.InvalidCommandError", (error) =>
                Effect.succeed(fail("INVALID_INPUT", error.message)),
              ),
            )

            if (!created.ok) return failure("Rotina inválida", created)
            const routineId = created.data.routineId

            yield* Effect.logInfo("routine.create", {
              routineId,
              actor: ctx.agent,
              sessionID: ctx.sessionID,
              callID: ctx.callID,
              trigger: plan.data.trigger,
              action: plan.data.action.kind,
            })
            yield* audit({
              action: "create",
              actor: ctx.agent,
              sessionID: ctx.sessionID,
              callID: ctx.callID,
              routineId,
              result: "created",
              details: { name: plan.data.name, trigger: plan.data.trigger },
            })

            return result("Rotina criada", created, { routineId })
          }

          if (params.action === "status") {
            const now = Date.now()
            const targets: Schedule.Info[] = []
            if (params.routineId) {
              const found = yield* schedules.get(Schedule.ID.make(params.routineId))
              if (!found) {
                return failure(
                  "Rotina não encontrada",
                  fail("ROUTINE_NOT_FOUND", `Rotina '${params.routineId}' não foi encontrada.`, {
                    routineId: params.routineId,
                  }),
                )
              }
              targets.push(found)
            } else {
              targets.push(...(yield* schedules.list()))
            }

            const scheduler = yield* schedules.schedulerHeartbeat()
            const routines = yield* Effect.forEach(targets, (routine) =>
              Effect.gen(function* () {
                const latest = yield* schedules.latestRun(routine.id)
                const health = ScheduleHealth.evaluateRoutine(routine, latest, now)
                return {
                  id: routine.id,
                  name: routine.name ?? "(Sem nome)",
                  description: routine.description ?? "",
                  enabled: routine.enabled,
                  trigger: routine.trigger,
                  state: health.state,
                  healthy: health.healthy,
                  reason: health.reason,
                  attempts: health.attempts,
                  lastError: health.lastError,
                  lastRun: latest
                    ? {
                        id: latest.id,
                        status: latest.status,
                        startedAt: iso(latest.startedAt),
                        finishedAt: iso(latest.finishedAt),
                        durationMs: latest.durationMs,
                        attempt: latest.attempt,
                        error: latest.error,
                      }
                    : null,
                  nextRunAt: iso(health.nextRunAt),
                  heartbeatAt: iso(health.heartbeatAt),
                  leaseUntil: iso(health.leaseUntil),
                }
              }),
            )

            const data = {
              routines,
              scheduler: {
                healthy:
                  scheduler?.leaseUntil !== undefined ? scheduler.leaseUntil > now : false,
                ownerId: scheduler?.ownerId,
                lastSeenAt: iso(scheduler?.lastSeen),
                leaseUntil: iso(scheduler?.leaseUntil),
              },
              checkedAt: iso(now),
            }

            yield* Effect.logInfo("routine.status", {
              routineId: params.routineId,
              count: routines.length,
              actor: ctx.agent,
              sessionID: ctx.sessionID,
            })
            yield* audit({
              action: "status",
              actor: ctx.agent,
              sessionID: ctx.sessionID,
              callID: ctx.callID,
              routineId: params.routineId,
              previousState: params.routineId ? routines[0]?.state : undefined,
              result: "ok",
              details: params.routineId
                ? { state: routines[0]?.state, healthy: routines[0]?.healthy }
                : { count: routines.length, states: routines.map((routine) => routine.state) },
            })

            return result(routines.length === 1 ? `Status: ${routines[0].name}` : "Status das Rotinas", ok(data), {
              routineId: params.routineId,
              state: routines.length === 1 ? routines[0].state : undefined,
            })
          }

          if (params.action === "restart") {
            const routineId = params.routineId?.trim()
            if (!routineId) {
              return failure(
                "Reinício inválido",
                fail("INVALID_INPUT", "O parâmetro 'routineId' é obrigatório para reiniciar.", {
                  field: "routineId",
                }),
              )
            }
            if (params.confirm !== true) {
              return failure(
                "Confirmação necessária",
                fail("CONFIRMATION_REQUIRED", "Defina 'confirm: true' para reiniciar uma rotina.", {
                  routineId,
                }),
                { routineId },
              )
            }

            const confirmed = yield* permit(
              ctx,
              "routine_restart",
              [routineId],
              [],
              { action: "restart", routineId },
            )
            if (!confirmed) {
              return failure(
                "Permissão negada",
                fail("PERMISSION_DENIED", "O reinício desta rotina não foi autorizado.", { routineId }),
                { routineId },
              )
            }

            const schedule = yield* schedules.get(Schedule.ID.make(routineId))
            if (!schedule) {
              return failure(
                "Rotina não encontrada",
                fail("ROUTINE_NOT_FOUND", `Rotina '${routineId}' não foi encontrada.`, { routineId }),
                { routineId },
              )
            }
            const latest = yield* schedules.latestRun(schedule.id)
            const previousState = ScheduleHealth.evaluateRoutine(schedule, latest, Date.now()).state

            const restarted = yield* ScheduleRunner.restartViaBridge(schedule.id).pipe(
              Effect.map((value) =>
                ok({
                  routineId: value.scheduleId,
                  previousState: value.previousState,
                  newState: value.newState,
                  runId: value.runId,
                  attempt: value.attempt,
                }),
              ),
              Effect.catchTag("Schedule.NotFoundError", () =>
                Effect.succeed(fail("ROUTINE_NOT_FOUND", `Rotina '${routineId}' não foi encontrada.`, { routineId })),
              ),
              Effect.catchTag("Schedule.RestartRejectedError", (error) =>
                Effect.succeed(
                  fail(error.code as ErrorCode, error.message, {
                    routineId,
                    state: error.state,
                    ...(error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}),
                  }),
                ),
              ),
              Effect.catchTag("Schedule.RestartUnavailableError", () =>
                Effect.succeed(
                  fail("ROUTINE_RESTART_FAILED", "O scheduler não está ativo neste processo.", { routineId }),
                ),
              ),
              Effect.catchCause((cause) =>
                Effect.gen(function* () {
                  yield* Effect.logError("routine.restart failed", { routineId, cause: Cause.pretty(cause) })
                  return fail("ROUTINE_RESTART_FAILED", "Não foi possível reiniciar a rotina.", { routineId })
                }),
              ),
            )

            yield* Effect.logInfo("routine.restart", {
              routineId,
              actor: ctx.agent,
              sessionID: ctx.sessionID,
              callID: ctx.callID,
              previousState,
              result: restarted.ok ? "running" : restarted.error.code,
            })
            yield* audit({
              action: "restart",
              actor: ctx.agent,
              sessionID: ctx.sessionID,
              callID: ctx.callID,
              routineId,
              previousState,
              result: restarted.ok ? restarted.data.newState : restarted.error.code,
              details: restarted.ok
                ? { runId: restarted.data.runId, attempt: restarted.data.attempt }
                : restarted.error.details,
            })

            if (!restarted.ok) {
              return failure("Falha ao reiniciar rotina", restarted, { routineId, state: previousState })
            }
            return result("Rotina reiniciada", restarted, {
              routineId,
              state: restarted.data.newState,
              previousState,
            })
          }

          return failure(
            "Ação inválida",
            fail("INVALID_INPUT", `Ação desconhecida: ${(params as { action: string }).action}`),
          )
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.gen(function* () {
              yield* Effect.logError("routine tool failed", { cause })
              return failure(
                "Erro interno",
                fail("INTERNAL_ERROR", "Não foi possível concluir a operação."),
              )
            }),
          ),
        ),
    }
  }),
)
