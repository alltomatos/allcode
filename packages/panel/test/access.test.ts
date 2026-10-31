import { describe, expect, test } from "bun:test"
import {
  FULL_ACCESS,
  NO_ACCESS,
  parseOverrides,
  resolveAccess,
  resolveCanOpenSettings,
  resolveDefaultModel,
  settingsAccess,
} from "../src/lib/access"

describe("access resolution", () => {
  test("individual overrides win over the group base", () => {
    const access = resolveAccess({
      individual: { agentui: true },
      groups: [{ agentui: false, routines: true }],
    })
    expect(access.agentui).toBe(true)
    expect(access.routines).toBe(true)
  })

  test("groups are merged as a union so one group never revokes another", () => {
    const access = resolveAccess({
      groups: [{ agentui: false }, { agentui: true, servers: false }],
    })
    expect(access.agentui).toBe(true)
    expect(access.servers).toBe(false)
  })

  test("unspecified resources fall back to full access (backwards compatible)", () => {
    expect(resolveAccess({})).toEqual(FULL_ACCESS)
  })

  test("tenant default applies before groups", () => {
    const access = resolveAccess({ tenant: { mcp: false }, groups: [{ skills: false }] })
    expect(access.mcp).toBe(false)
    expect(access.skills).toBe(false)
    expect(access.models).toBe(true)
  })

  test("the RH reference profile denies agents/providers/models/combos/servers but keeps routines, skills, memories and mcp", () => {
    const rh = { ...NO_ACCESS, routines: true, skills: true, memories: true, mcp: true }
    const access = resolveAccess({ groups: [rh] })
    expect(access.agentui).toBe(false)
    expect(access.routines).toBe(true)
    expect(access.servers).toBe(false)
    expect(access.providers).toBe(false)
    expect(access.models).toBe(false)
    expect(access.combos).toBe(false)
    expect(access.skills).toBe(true)
    expect(access.memories).toBe(true)
    expect(access.mcp).toBe(true)
  })

  test("settings sections follow the resource map and the master switch", () => {
    const access = resolveAccess({ groups: [{ providers: false }] })
    const settings = settingsAccess(access, true)
    expect(settings.providers).toBe(false)
    expect(settings.models).toBe(true)
    expect(settingsAccess(access, false).models).toBe(false)
  })
})

describe("default model precedence", () => {
  test("manager per-user default wins over the tenant default", () => {
    expect(
      resolveDefaultModel({ provider: "anthropic", model: "sonnet" }, { provider: "openai", model: "gpt" }),
    ).toEqual({ provider: "anthropic", model: "sonnet" })
  })

  test("falls back to the tenant default when the user has none", () => {
    expect(resolveDefaultModel(undefined, { provider: "openai", model: "gpt-4o" })).toEqual({
      provider: "openai",
      model: "gpt-4o",
    })
  })

  test("a user provider without a model does not borrow the tenant model", () => {
    expect(resolveDefaultModel({ provider: "anthropic" }, { provider: "openai", model: "gpt-4o" })).toEqual({
      provider: "anthropic",
      model: undefined,
    })
  })

  test("returns undefined when nothing is configured", () => {
    expect(resolveDefaultModel(undefined, undefined)).toBeUndefined()
  })
})

describe("settings visibility", () => {
  test("an explicit per-user flag wins over groups", () => {
    expect(resolveCanOpenSettings(false, [{ canOpenSettings: true }])).toBe(false)
    expect(resolveCanOpenSettings(true, [{ canOpenSettings: false }])).toBe(true)
  })

  test("groups merge as a union so one group keeps settings open", () => {
    expect(resolveCanOpenSettings(undefined, [{ canOpenSettings: false }, { canOpenSettings: true }])).toBe(true)
    expect(resolveCanOpenSettings(undefined, [{ canOpenSettings: false }])).toBe(false)
  })

  test("no groups keeps the backwards-compatible default", () => {
    expect(resolveCanOpenSettings(undefined, [])).toBe(true)
  })
})

describe("override parsing", () => {
  test("ignores unknown keys and non-boolean values", () => {
    expect(parseOverrides('{"agentui":false,"models":"yes","unknown":true}')).toEqual({ agentui: false })
  })

  test("survives malformed JSON", () => {
    expect(parseOverrides("{not json")).toEqual({})
    expect(parseOverrides(null)).toEqual({})
  })
})
