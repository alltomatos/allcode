import { describe, expect, test } from "bun:test"
import type { Session } from "@allcode/sdk/v2/client"
import { sessionTokenMetrics } from "./session-view-metrics"

const mockSession = (overrides: Partial<Session> = {}): Session => ({
  id: "ses_1",
  slug: "ses_1",
  projectID: "proj_1",
  workspaceID: "ws_1",
  directory: "/path/to/my-project",
  title: "Test Session",
  version: "1",
  cost: 0.05,
  tokens: {
    input: 1000,
    output: 500,
    reasoning: 200,
    cache: { read: 300, write: 50 },
  },
  model: { providerID: "anthropic", id: "claude-3-7-sonnet" },
  agent: "build",
  time: { created: 1700000000000, updated: 1700000000000 },
  ...overrides,
})

describe("sessionTokenMetrics", () => {
  test("sessão ainda não carregada não tem uso", () => {
    const result = sessionTokenMetrics(undefined)
    expect(result).toEqual({ hasUsage: false, input: 0, output: 0, total: 0, tps: undefined })
  })

  test("sessão nova sem uso registrado é estado vazio explícito", () => {
    const result = sessionTokenMetrics(mockSession({ tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } }))
    expect(result.hasUsage).toBe(false)
    expect(result.tps).toBeUndefined()
    expect(result.total).toBe(0)
  })

  test("reflete entrada, saída, total e tokens por segundo do backend", () => {
    const result = sessionTokenMetrics(mockSession({ time: { created: 1700000000000, updated: 1700000010000 } }))
    expect(result.hasUsage).toBe(true)
    expect(result.input).toBe(1000)
    expect(result.output).toBe(500)
    // input + output + reasoning + cache.read + cache.write
    expect(result.total).toBe(2050)
    // 500 tokens de saída em 10s
    expect(result.tps).toBe(50)
  })

  test("sem tempo ativo não divide por zero", () => {
    const result = sessionTokenMetrics(mockSession())
    expect(result.total).toBe(2050)
    expect(result.tps).toBeUndefined()
    expect(Number.isFinite(result.tps ?? 0)).toBe(true)
  })

  test("valores não finitos são saneados em vez de virar NaN", () => {
    const result = sessionTokenMetrics(
      mockSession({
        tokens: {
          input: Number.NaN,
          output: Number.POSITIVE_INFINITY,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
      }),
    )
    expect(result.input).toBe(0)
    expect(result.output).toBe(0)
    expect(result.total).toBe(0)
    expect(result.hasUsage).toBe(false)
    expect(result.tps).toBeUndefined()
  })
})
