import { Schema } from "effect"
import { Schedule } from "@allcode/core/schedule"

export const RoutineAction = Schema.Literals(["list", "get", "create", "status", "restart"])
export type RoutineAction = typeof RoutineAction.Type

export const ScheduleInput = Schema.Struct({
  kind: Schema.Literals(["cron", "interval", "once", "manual"]).annotate({
    description: "Trigger kind: cron, interval, once (single execution) or manual.",
  }),
  expr: Schema.optional(Schema.String).annotate({
    description: "5-field cron expression, e.g. '0 9 * * 1-5'. Required for kind 'cron'.",
  }),
  intervalMs: Schema.optional(Schema.Number).annotate({
    description: "Interval in milliseconds. Required for kind 'interval' unless everyMinutes is provided.",
  }),
  everyMinutes: Schema.optional(Schema.Number).annotate({
    description: "Interval in minutes (convenience alternative to intervalMs).",
  }),
  at: Schema.optional(Schema.String).annotate({
    description: "ISO-8601 date/time (or 'YYYY-MM-DD HH:mm') for kind 'once'.",
  }),
})

export const ToolRef = Schema.Struct({
  server: Schema.String,
  tool: Schema.String,
})

export const Parameters = Schema.Struct({
  action: RoutineAction.annotate({
    description: "Operation: list, get, create, status (health) or restart (recover a stalled/failed routine).",
  }),
  routineId: Schema.optional(Schema.String).annotate({
    description: "Routine/schedule ID (e.g. sch_...). Required for get, status with a single routine, and restart.",
  }),
  name: Schema.optional(Schema.String).annotate({
    description: "Routine display name. Required for create.",
  }),
  description: Schema.optional(Schema.String).annotate({
    description: "Optional human-readable description for create.",
  }),
  prompt: Schema.optional(Schema.String).annotate({
    description:
      "Instructions the routine executes (skill action), or the message sent to an AgentUI agent when agentId is set. Required for create.",
  }),
  schedule: Schema.optional(ScheduleInput).annotate({
    description: "When the routine runs. Required for create.",
  }),
  model: Schema.optional(Schema.String).annotate({
    description: "Optional model override in 'providerID/modelID' or 'combo:<id>' form (skill actions).",
  }),
  tools: Schema.optional(Schema.Array(ToolRef)).annotate({
    description: "MCP tools enabled for this routine (skill actions), as { server, tool } pairs.",
  }),
  agentId: Schema.optional(Schema.String).annotate({
    description: "AgentUI agent ID. When set, the routine dispatches prompt to that agent instead of running a skill.",
  }),
  workspace: Schema.optional(Schema.String).annotate({
    description: "Primary workspace/project directory for the routine.",
  }),
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the routine starts enabled. Defaults to true.",
  }),
  timeoutMinutes: Schema.optional(Schema.Number).annotate({
    description: "Maximum execution time in minutes (1-1440). Defaults to the global 30-minute timeout.",
  }),
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)).annotate({
    description: "Free-form metadata persisted with the routine.",
  }),
  idempotencyKey: Schema.optional(Schema.String).annotate({
    description: "Stable key so retries return the already-created routine instead of creating a duplicate.",
  }),
  confirm: Schema.optional(Schema.Boolean).annotate({
    description: "Must be true for destructive actions such as restart.",
  }),
})
export type Parameters = typeof Parameters.Type

export type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CRON"
  | "INVALID_INTERVAL"
  | "INVALID_ONCE"
  | "ROUTINE_NOT_FOUND"
  | "ROUTINE_DUPLICATE"
  | "ROUTINE_DISABLED"
  | "ROUTINE_NOT_STALLED"
  | "ROUTINE_RESTART_LIMIT"
  | "ROUTINE_RESTART_COOLDOWN"
  | "ROUTINE_RESTART_IN_PROGRESS"
  | "ROUTINE_RESTART_FAILED"
  | "CONFIRMATION_REQUIRED"
  | "PERMISSION_DENIED"
  | "INTERNAL_ERROR"

export interface ToolError {
  readonly code: ErrorCode
  readonly message: string
  readonly details?: Record<string, unknown>
}

export type Envelope<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: ToolError }

export interface CreatePlan {
  readonly name: string
  readonly description?: string
  readonly trigger: Schedule.Trigger
  readonly action: Schedule.Action
  readonly workspace?: string
  readonly enabled: boolean
  readonly idempotencyKey?: string
  readonly metadata?: Record<string, unknown>
}

export function ok<T>(data: T): Envelope<T> {
  return { ok: true, data }
}

export function fail(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Envelope<never> {
  return { ok: false, error: { code, message, details } }
}

export function buildCreatePlan(input: Parameters): Envelope<CreatePlan> {
  const name = input.name?.trim()
  if (!name) return fail("INVALID_INPUT", "Field 'name' is required.", { field: "name" })

  const prompt = input.prompt?.trim()
  if (!prompt) return fail("INVALID_INPUT", "Field 'prompt' is required.", { field: "prompt" })

  if (!input.schedule) {
    return fail("INVALID_INPUT", "Field 'schedule' is required.", { field: "schedule" })
  }

  const trigger = buildTrigger(input.schedule)
  if (!trigger.ok) return trigger

  if (input.timeoutMinutes !== undefined && (input.timeoutMinutes < 1 || input.timeoutMinutes > 1440)) {
    return fail("INVALID_INPUT", "Field 'timeoutMinutes' must be between 1 and 1440.", {
      field: "timeoutMinutes",
    })
  }

  const timeoutMs = input.timeoutMinutes !== undefined ? Math.round(input.timeoutMinutes * 60_000) : undefined
  const tools = input.tools?.filter((tool) => tool.server.trim() && tool.tool.trim())
  if (input.tools?.some((tool) => !tool.server.trim() || !tool.tool.trim())) {
    return fail("INVALID_INPUT", "Every entry in 'tools' needs non-empty server and tool fields.", {
      field: "tools",
    })
  }
  if (input.agentId && (tools?.length || input.model)) {
    return fail("INVALID_INPUT", "'tools' and 'model' only apply to skill routines, not agentId routines.", {
      field: input.model ? "model" : "tools",
    })
  }

  const action: Schedule.Action = input.agentId
    ? {
        kind: "agentui",
        agentId: input.agentId.trim(),
        message: prompt,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      }
    : {
        kind: "skill",
        instructions: prompt,
        ...(tools?.length ? { mcpTools: tools } : {}),
        ...(input.workspace ? { workspaces: [input.workspace] } : {}),
        ...(input.model ? { model: input.model } : {}),
        permission: "auto",
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      }

  return ok({
    name,
    description: input.description?.trim() || undefined,
    trigger: trigger.data,
    action,
    workspace: input.workspace,
    enabled: input.enabled ?? true,
    idempotencyKey: input.idempotencyKey?.trim() || undefined,
    metadata: input.metadata,
  })
}

export function buildTrigger(input: NonNullable<Parameters["schedule"]>): Envelope<Schedule.Trigger> {
  if (input.kind === "manual") return ok({ kind: "manual" })

  if (input.kind === "cron") {
    const expr = input.expr?.trim()
    if (!expr) return fail("INVALID_INPUT", "Field 'schedule.expr' is required for cron.", { field: "schedule.expr" })
    if (!Schedule.isValidCron(expr)) {
      return fail("INVALID_CRON", `Invalid cron expression: "${expr}". Expected 5 fields.`, {
        field: "schedule.expr",
        value: expr,
      })
    }
    return ok({ kind: "cron", expr })
  }

  if (input.kind === "interval") {
    const ms = input.intervalMs ?? (input.everyMinutes !== undefined ? input.everyMinutes * 60_000 : undefined)
    if (ms === undefined || !Number.isFinite(ms) || ms < 1_000) {
      return fail("INVALID_INTERVAL", "Interval must be at least 1000ms (or one minute via everyMinutes).", {
        field: "schedule.intervalMs",
      })
    }
    return ok({ kind: "interval", ms: Math.round(ms) })
  }

  const timestamp = input.at ? parseWhen(input.at) : undefined
  if (timestamp === undefined) {
    return fail("INVALID_ONCE", "Field 'schedule.at' must be a valid ISO-8601 date/time.", {
      field: "schedule.at",
    })
  }
  return ok({ kind: "once", timestamp })
}

function parseWhen(value: string): number | undefined {
  const parsed = Date.parse(value)
  if (!isNaN(parsed)) return parsed
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return undefined
  const [, year, month, day, hour, minute, second] = match
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    second ? parseInt(second, 10) : 0,
  ).getTime()
}

export function sameRoutineKey(
  schedule: { name?: string; trigger: Schedule.Trigger },
  name: string,
  trigger: Schedule.Trigger,
): boolean {
  return (schedule.name ?? "").trim().toLowerCase() === name.trim().toLowerCase() &&
    JSON.stringify(schedule.trigger) === JSON.stringify(trigger)
}

