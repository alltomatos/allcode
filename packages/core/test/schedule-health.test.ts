import { describe, expect, test } from "bun:test"
import { Schedule } from "@allcode/core/schedule"
import { ScheduleHealth } from "@allcode/core/schedule/health"

const now = Date.UTC(2026, 9, 28, 12, 0, 0)

function schedule(overrides?: Partial<ConstructorParameters<typeof Schedule.Info>[0]>) {
  return new Schedule.Info({
    id: Schedule.ID.make("sch_health"),
    trigger: { kind: "interval", ms: 60_000 },
    action: { kind: "shell", command: "true" },
    enabled: true,
    ...overrides,
  })
}

function run(overrides?: Partial<ScheduleHealth.RunSnapshot>): ScheduleHealth.RunSnapshot {
  return {
    id: "run_health",
    status: "running",
    startedAt: now - 5_000,
    durationMs: 5_000,
    attempt: 1,
    heartbeatAt: now - 5_000,
    leaseUntil: now + 60_000,
    ...overrides,
  }
}

describe("schedule health", () => {
  test("queued when enabled and never executed", () => {
    expect(ScheduleHealth.evaluateRoutine(schedule(), undefined, now)).toMatchObject({
      state: "queued",
      healthy: true,
      attempts: 1,
      reason: "awaiting_first_run",
    })
  })

  test("disabled wins over previous success", () => {
    const health = ScheduleHealth.evaluateRoutine(
      schedule({ enabled: false }),
      run({ status: "success", finishedAt: now - 1_000 }),
      now,
    )
    expect(health).toMatchObject({ state: "disabled", healthy: false, reason: "disabled" })
  })

  test("running with a fresh heartbeat is healthy", () => {
    expect(ScheduleHealth.evaluateRoutine(schedule(), run(), now)).toMatchObject({
      state: "running",
      healthy: true,
    })
  })

  test("detects a missing heartbeat", () => {
    const health = ScheduleHealth.evaluateRoutine(
      schedule(),
      run({ heartbeatAt: now - ScheduleHealth.HEARTBEAT_STALE_MS - 1 }),
      now,
    )
    expect(health).toMatchObject({ state: "stalled", healthy: false, reason: "heartbeat_missing" })
  })

  test("detects an expired lease", () => {
    const health = ScheduleHealth.evaluateRoutine(schedule(), run({ leaseUntil: now - 1 }), now)
    expect(health).toMatchObject({ state: "stalled", healthy: false, reason: "lease_expired" })
  })

  test("detects execution over the configured timeout plus grace", () => {
    const health = ScheduleHealth.evaluateRoutine(
      schedule({ action: { kind: "shell", command: "true", timeoutMs: 1_000 } }),
      run({ startedAt: now - 120_000, heartbeatAt: now, leaseUntil: now + 60_000 }),
      now,
    )
    expect(health).toMatchObject({ state: "stalled", reason: "timeout_exceeded" })
  })

  test("maps terminal run statuses", () => {
    expect(
      ScheduleHealth.evaluateRoutine(schedule(), run({ status: "success", finishedAt: now }), now),
    ).toMatchObject({ state: "succeeded", healthy: true })
    expect(
      ScheduleHealth.evaluateRoutine(schedule(), run({ status: "error", error: "boom", finishedAt: now }), now),
    ).toMatchObject({ state: "failed", healthy: false, lastError: "boom" })
    expect(
      ScheduleHealth.evaluateRoutine(schedule(), run({ status: "timeout", finishedAt: now }), now),
    ).toMatchObject({ state: "failed", healthy: false })
    expect(
      ScheduleHealth.evaluateRoutine(schedule(), run({ status: "skipped", finishedAt: now }), now),
    ).toMatchObject({ state: "queued", healthy: true, reason: "skipped" })
  })

  test("uses the configured timeout with global fallback", () => {
    expect(ScheduleHealth.actionTimeoutMs({ kind: "skill", instructions: "x", timeoutMs: 1234 })).toBe(1234)
    expect(ScheduleHealth.actionTimeoutMs({ kind: "shell", command: "true" })).toBe(
      ScheduleHealth.DEFAULT_ACTION_TIMEOUT_MS,
    )
  })

  test("computes next runs for every trigger kind", () => {
    expect(ScheduleHealth.nextRunAt({ kind: "manual" }, undefined, now)).toBeUndefined()
    expect(ScheduleHealth.nextRunAt({ kind: "once", timestamp: now + 10_000 }, undefined, now)).toBe(now + 10_000)
    expect(ScheduleHealth.nextRunAt({ kind: "once", timestamp: now }, now, now)).toBeUndefined()
    expect(ScheduleHealth.nextRunAt({ kind: "interval", ms: 5_000 }, now, now)).toBe(now + 5_000)
    expect(ScheduleHealth.nextRunAt({ kind: "interval", ms: 5_000 }, undefined, now)).toBe(now + 5_000)
  })

  test("mirrors the scheduler cron matching for next runs", () => {
    const mondayNine = new Date(2026, 9, 26, 9, 0, 0).getTime()
    const next = ScheduleHealth.nextRunAt({ kind: "cron", expr: "0 9 * * 1" }, undefined, mondayNine)
    expect(new Date(next!).getDay()).toBe(1)
    expect(new Date(next!).getHours()).toBe(9)
  })
})
