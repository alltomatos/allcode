export * as ScheduleHealth from "./health"

import type { Schedule } from "../schedule"

export const DEFAULT_ACTION_TIMEOUT_MS = 30 * 60_000
export const HEARTBEAT_STALE_MS = 45_000
export const STALL_GRACE_MS = 60_000
export const MAX_RESTART_ATTEMPTS = 5
export const RESTART_COOLDOWN_MS = 10_000

export type RoutineState = "queued" | "running" | "succeeded" | "failed" | "stalled" | "disabled"

export interface RunSnapshot {
  readonly id: string
  readonly status: Schedule.RunStatus
  readonly startedAt: number
  readonly durationMs: number
  readonly attempt: number
  readonly error?: string
  readonly finishedAt?: number
  readonly trigger?: Schedule.RunTrigger
  readonly scheduledFor?: number
  readonly claimedBy?: string
  readonly leaseUntil?: number
  readonly heartbeatAt?: number
}

export interface RoutineHealth {
  readonly state: RoutineState
  readonly healthy: boolean
  readonly reason?: string
  readonly attempts: number
  readonly lastError?: string
  readonly heartbeatAt?: number
  readonly leaseUntil?: number
  readonly nextRunAt?: number
  readonly lastRun?: RunSnapshot
}

export function actionTimeoutMs(action: Schedule.Action, fallback = DEFAULT_ACTION_TIMEOUT_MS): number {
  return "timeoutMs" in action && typeof action.timeoutMs === "number" && action.timeoutMs > 0
    ? action.timeoutMs
    : fallback
}

export function isRunStalled(
  run: RunSnapshot,
  action: Schedule.Action,
  now: number,
  options?: { readonly heartbeatThresholdMs?: number; readonly graceMs?: number; readonly timeoutMs?: number },
): boolean {
  if (run.status !== "running") return false
  if (run.leaseUntil !== undefined && now >= run.leaseUntil) return true

  const heartbeat = run.heartbeatAt ?? run.startedAt
  if (now - heartbeat > (options?.heartbeatThresholdMs ?? HEARTBEAT_STALE_MS)) return true

  return now - run.startedAt > actionTimeoutMs(action, options?.timeoutMs) + (options?.graceMs ?? STALL_GRACE_MS)
}

export function evaluateRoutine(
  schedule: Schedule.Info,
  latestRun: RunSnapshot | undefined,
  now: number,
  options?: { readonly heartbeatThresholdMs?: number; readonly graceMs?: number; readonly timeoutMs?: number },
): RoutineHealth {
  const attempts = latestRun?.attempt ?? 1
  const last = {
    attempts,
    lastError: latestRun?.error ?? schedule.lastError,
    heartbeatAt: latestRun?.heartbeatAt,
    leaseUntil: latestRun?.leaseUntil,
    nextRunAt: nextRunAt(schedule.trigger, schedule.lastRunAt, now) ?? undefined,
    lastRun: latestRun,
  }

  if (!schedule.enabled) {
    return { ...last, state: "disabled", healthy: false, reason: "disabled" }
  }

  if (!latestRun) {
    return { ...last, state: "queued", healthy: true, reason: "awaiting_first_run" }
  }

  if (latestRun.status === "running") {
    if (isRunStalled(latestRun, schedule.action, now, options)) {
      const heartbeat = latestRun.heartbeatAt ?? latestRun.startedAt
      const reason =
        latestRun.leaseUntil !== undefined && now >= latestRun.leaseUntil
          ? "lease_expired"
          : now - heartbeat > (options?.heartbeatThresholdMs ?? HEARTBEAT_STALE_MS)
            ? "heartbeat_missing"
            : "timeout_exceeded"
      return { ...last, state: "stalled", healthy: false, reason }
    }
    return { ...last, state: "running", healthy: true }
  }

  if (latestRun.status === "success") {
    return { ...last, state: "succeeded", healthy: true }
  }

  if (latestRun.status === "skipped") {
    return { ...last, state: "queued", healthy: true, reason: "skipped" }
  }

  return { ...last, state: "failed", healthy: false, reason: "last_run_failed" }
}

export function nextRunAt(trigger: Schedule.Trigger, lastRunAt: number | undefined, fromMs: number): number | undefined {
  if (trigger.kind === "manual") return undefined
  if (trigger.kind === "once") {
    if (lastRunAt !== undefined && lastRunAt >= trigger.timestamp) return undefined
    return trigger.timestamp
  }
  if (trigger.kind === "interval") {
    if (trigger.ms <= 0) return undefined
    return lastRunAt !== undefined ? lastRunAt + trigger.ms : fromMs + trigger.ms
  }
  return nextCronMatch(trigger.expr, fromMs)
}

function nextCronMatch(expr: string, fromMs: number): number | undefined {
  const start = Math.floor(fromMs / 60_000) * 60_000 + 60_000
  const limit = start + 30 * 24 * 60 * 60_000
  for (let at = start; at <= limit; at += 60_000) {
    if (matchesCron(expr, new Date(at))) return at
  }
  return undefined
}

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

function matchesCron(expr: string, date: Date): boolean {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false

  if (!matchCronPart(parts[0], date.getMinutes(), 0)) return false
  if (!matchCronPart(parts[1], date.getHours(), 0)) return false
  if (!matchCronPart(parts[3], date.getMonth() + 1, 1)) return false

  const dayOfMonth = date.getDate()
  const dayOfWeek = date.getDay()
  const domRestricted = parts[2] !== "*"
  const dowRestricted = parts[4] !== "*"
  const domMatch = matchCronPart(parts[2], dayOfMonth, 1)
  const dowMatch =
    matchCronPart(parts[4], dayOfWeek, 0) || (dayOfWeek === 0 && matchCronPart(parts[4], 7, 0))

  if (domRestricted && dowRestricted) return domMatch || dowMatch
  if (domRestricted && !domMatch) return false
  if (dowRestricted && !dowMatch) return false
  return true
}
