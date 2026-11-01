import { describe, expect, test } from "bun:test"
import { OpencodeFingerprint } from "../../src/session/llm/opencode-fingerprint"

describe("opencode free-tier fingerprint", () => {
  test("declares the native quartet without an executor", () => {
    const tools = OpencodeFingerprint.tools()
    expect(Object.keys(tools).sort()).toEqual(["bash", "edit", "read", "write"])
    for (const tool of Object.values(tools)) expect(tool.execute).toBeUndefined()
  })

  test("does not replace tools the caller already supplied", () => {
    const existing = { bash: { description: "caller bash" } } as any
    const tools = OpencodeFingerprint.augment(existing)
    expect(tools.bash).toBe(existing.bash)
    expect(Object.keys(tools).sort()).toEqual(["bash", "edit", "read", "write"])
  })

  test("detects free models by id and zero input cost", () => {
    expect(OpencodeFingerprint.isFree({ id: "deepseek-v4.1-flash-free" })).toBe(true)
    expect(OpencodeFingerprint.isFree({ id: "big-pickle", cost: { input: 0 } })).toBe(true)
    expect(OpencodeFingerprint.isFree({ id: "deepseek-v4.1-flash", cost: { input: 0.3 } })).toBe(false)
  })
})
