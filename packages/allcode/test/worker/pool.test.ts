import { afterAll, describe, expect, test } from "bun:test"
import { Token } from "@allcode/core/util/token"
import { WorkerPool } from "../../src/worker/pool"

afterAll(() => WorkerPool.close())

describe("WorkerPool", () => {
  test("runs a self-contained function off the main thread", async () => {
    const result = await WorkerPool.run((input: { value: number }) => input.value * 2, { value: 21 })
    expect(result).toBe(42)
  })

  test("serves concurrent tasks", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        WorkerPool.run((input: { value: number }) => input.value + 1, { value: index }),
      ),
    )
    expect(results).toEqual(Array.from({ length: 12 }, (_, index) => index + 1))
  })

  test("propagates task errors", async () => {
    await expect(
      WorkerPool.run(() => {
        throw new Error("boom")
      }, undefined),
    ).rejects.toThrow(/boom/)
  })

  test("estimateJsonTokens matches the inline estimator", async () => {
    const payload = { messages: Array.from({ length: 200 }, (_, index) => `message number ${index}`) }
    const offloaded = await WorkerPool.run(WorkerPool.estimateJsonTokens, payload)
    expect(offloaded).toBe(Token.estimate(JSON.stringify(payload)))
  })
})
