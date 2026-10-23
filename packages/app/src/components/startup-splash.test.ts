import { describe, expect, test } from "bun:test"
import { splashPhase } from "./startup-splash"
import type { ReadinessSnapshot } from "@/startup/readiness"

function snapshot(overrides: Partial<ReadinessSnapshot> = {}): ReadinessSnapshot {
  return {
    services: [],
    started: true,
    allReady: false,
    failed: false,
    completed: 0,
    total: 1,
    current: undefined,
    warnings: [],
    ...overrides,
  }
}

describe("startup splash gate", () => {
  test("stays in loading while any required service is pending", () => {
    expect(splashPhase(snapshot(), false, false)).toBe("loading")
  })

  test("switches to the error state when a required service fails", () => {
    expect(splashPhase(snapshot({ failed: true }), false, false)).toBe("error")
    expect(splashPhase(snapshot({ failed: true, allReady: true }), true, false)).toBe("error")
  })

  test("only dismisses the splash after all services are ready and the fade completes", () => {
    expect(splashPhase(snapshot({ allReady: true }), false, false)).toBe("loading")
    expect(splashPhase(snapshot({ allReady: true }), true, false)).toBe("leaving")
    expect(splashPhase(snapshot({ allReady: true }), true, true)).toBe("dismissed")
  })
})
