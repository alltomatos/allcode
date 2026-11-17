import { describe, expect, test } from "bun:test"
import { isFreeModel } from "./model-free"

describe("isFreeModel", () => {
  test("treats zero input price as free for opencode", () => {
    expect(isFreeModel("opencode", { input: 0 })).toBe(true)
    expect(isFreeModel("opencode", undefined)).toBe(true)
  })

  test("treats zero input price as free for opencode-go", () => {
    expect(isFreeModel("opencode-go", { input: 0 })).toBe(true)
  })

  test("treats priced models as paid", () => {
    expect(isFreeModel("opencode", { input: 0.14 })).toBe(false)
    expect(isFreeModel("opencode-go", { input: 1.4 })).toBe(false)
  })

  test("ignores other providers", () => {
    expect(isFreeModel("anthropic", { input: 0 })).toBe(false)
  })
})
