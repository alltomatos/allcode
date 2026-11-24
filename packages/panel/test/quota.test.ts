import { describe, expect, test } from "bun:test"
import {
  cycleWindow,
  effectiveUserLimit,
  formatTokenAmount,
  normalizeCycleDay,
  parseTokenAmount,
  quotaExceeded,
  resolveQuotaState,
} from "../src/lib/quota"

describe("parseTokenAmount", () => {
  test("parses k/M/B suffixes", () => {
    expect(parseTokenAmount("900k")).toBe(900_000)
    expect(parseTokenAmount("1M")).toBe(1_000_000)
    expect(parseTokenAmount("50M")).toBe(50_000_000)
    expect(parseTokenAmount("2b")).toBe(2_000_000_000)
  })

  test("parses decimals and thousand separators", () => {
    expect(parseTokenAmount("1,5M")).toBe(1_500_000)
    expect(parseTokenAmount("1.5M")).toBe(1_500_000)
    expect(parseTokenAmount("50.000.000")).toBe(50_000_000)
    expect(parseTokenAmount("1_000")).toBe(1_000)
  })

  test("rejects zero, negative and malformed input", () => {
    expect(parseTokenAmount("0")).toBeNull()
    expect(parseTokenAmount("-1M")).toBeNull()
    expect(parseTokenAmount("abc")).toBeNull()
    expect(parseTokenAmount("")).toBeNull()
    expect(parseTokenAmount(0)).toBeNull()
    expect(parseTokenAmount(-5)).toBeNull()
  })
})

describe("formatTokenAmount", () => {
  test("formats compact token values", () => {
    expect(formatTokenAmount(900_000)).toBe("900k")
    expect(formatTokenAmount(1_000_000)).toBe("1M")
    expect(formatTokenAmount(1_500_000)).toBe("1.5M")
    expect(formatTokenAmount(50_000_000)).toBe("50M")
    expect(formatTokenAmount(null)).toBe("∞")
  })
})

describe("cycleWindow", () => {
  test("uses the current month when the closing day already passed", () => {
    const window = cycleWindow(1, new Date("2026-03-15T12:00:00Z"))
    expect(window.start).toBe("2026-03-01T00:00:00.000Z")
    expect(window.end).toBe("2026-04-01T00:00:00.000Z")
  })

  test("uses the previous month before the closing day", () => {
    const window = cycleWindow(10, new Date("2026-03-05T12:00:00Z"))
    expect(window.start).toBe("2026-02-10T00:00:00.000Z")
    expect(window.end).toBe("2026-03-10T00:00:00.000Z")
  })

  test("clamps the closing day to the month length", () => {
    const window = cycleWindow(31, new Date("2026-03-15T12:00:00Z"))
    expect(window.start).toBe("2026-02-28T00:00:00.000Z")
    expect(window.end).toBe("2026-03-31T00:00:00.000Z")
  })

  test("normalizes invalid closing days to 1", () => {
    expect(normalizeCycleDay(0)).toBe(1)
    expect(normalizeCycleDay(99)).toBe(31)
    expect(normalizeCycleDay("x")).toBe(1)
  })
})

describe("resolveQuotaState", () => {
  const cycleStart = "2026-03-01T00:00:00.000Z"
  const cycleEnd = "2026-04-01T00:00:00.000Z"

  test("allows consumption while both limits have room", () => {
    const state = resolveQuotaState({
      companyLimit: 50_000_000,
      userLimit: 1_000_000,
      companyUsed: 2_000_000,
      userUsed: 900_000,
      cycleStart,
      cycleEnd,
    })
    expect(state.blocked).toBe(false)
    expect(state.company.remaining).toBe(48_000_000)
    expect(state.user.remaining).toBe(100_000)
  })

  test("blocks on the individual quota when it is reached", () => {
    const state = resolveQuotaState({
      companyLimit: 50_000_000,
      userLimit: 1_000_000,
      companyUsed: 2_000_000,
      userUsed: 1_000_000,
      cycleStart,
      cycleEnd,
    })
    expect(state.blocked).toBe(true)
    expect(state.scope).toBe("user")
    expect(quotaExceeded(state)?.scope).toBe("user")
  })

  test("blocks on the company pool when it is exhausted", () => {
    const state = resolveQuotaState({
      companyLimit: 50_000_000,
      userLimit: 1_000_000,
      companyUsed: 50_000_000,
      userUsed: 100_000,
      cycleStart,
      cycleEnd,
    })
    expect(state.blocked).toBe(true)
    expect(state.scope).toBe("company")
  })

  test("prioritizes the company scope when both limits are exhausted", () => {
    const state = resolveQuotaState({
      companyLimit: 1_000_000,
      userLimit: 1_000_000,
      companyUsed: 1_000_000,
      userUsed: 1_000_000,
      cycleStart,
      cycleEnd,
    })
    expect(state.scope).toBe("company")
  })

  test("treats null limits as unlimited", () => {
    const state = resolveQuotaState({
      companyLimit: null,
      userLimit: null,
      companyUsed: 99_000_000,
      userUsed: 99_000_000,
      cycleStart,
      cycleEnd,
    })
    expect(state.blocked).toBe(false)
    expect(state.company.remaining).toBeNull()
    expect(state.user.remaining).toBeNull()
  })
})

describe("effectiveUserLimit precedence", () => {
  test("individual quota overrides the company-wide quota", () => {
    const effective = effectiveUserLimit({
      individual: 900_000,
      global: 5_000_000,
      companyPool: 50_000_000,
    })
    expect(effective.limit).toBe(900_000)
    expect(effective.source).toBe("individual")
  })

  test("falls back to the company-wide quota when there is no individual override", () => {
    const effective = effectiveUserLimit({
      individual: null,
      global: 5_000_000,
      companyPool: 50_000_000,
    })
    expect(effective.limit).toBe(5_000_000)
    expect(effective.source).toBe("company")
  })

  test("falls back to the company pool when no sub-limit is configured", () => {
    const effective = effectiveUserLimit({
      individual: null,
      global: null,
      companyPool: 50_000_000,
    })
    expect(effective.limit).toBeNull()
    expect(effective.source).toBe("pool")
  })

  test("never exceeds the company pool", () => {
    const effective = effectiveUserLimit({
      individual: 60_000_000,
      global: 5_000_000,
      companyPool: 50_000_000,
    })
    expect(effective.limit).toBe(50_000_000)
  })
})
