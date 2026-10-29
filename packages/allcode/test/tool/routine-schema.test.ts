import { describe, expect, test } from "bun:test"
import { buildCreatePlan, sameRoutineKey } from "../../src/tool/routine-schema"
import { buildAgentInput, validModel } from "../../src/tool/agentui"

const base = {
  action: "create" as const,
  name: "Daily report",
  prompt: "Summarize the day.",
  schedule: { kind: "cron" as const, expr: "0 9 * * *" },
}

describe("routine create validation", () => {
  test("requires name, prompt and schedule", () => {
    expect(buildCreatePlan({ action: "create", prompt: "x", schedule: base.schedule })).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT", details: { field: "name" } },
    })
    expect(buildCreatePlan({ action: "create", name: "x", schedule: base.schedule })).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT", details: { field: "prompt" } },
    })
    expect(buildCreatePlan({ action: "create", name: "x", prompt: "y" })).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT", details: { field: "schedule" } },
    })
  })

  test("rejects invalid cron, interval and once inputs", () => {
    expect(
      buildCreatePlan({ ...base, schedule: { kind: "cron", expr: "99 * * * *" } }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_CRON", details: { field: "schedule.expr" } } })
    expect(
      buildCreatePlan({ ...base, schedule: { kind: "interval", everyMinutes: 0 } }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_INTERVAL" } })
    expect(
      buildCreatePlan({ ...base, schedule: { kind: "once", at: "not-a-date" } }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_ONCE" } })
  })

  test("builds a skill action with tools, model and timeout", () => {
    const plan = buildCreatePlan({
      ...base,
      description: "  weekly  ",
      model: "openai/gpt-5",
      tools: [{ server: "github", tool: "list_issues" }],
      workspace: "/repo",
      timeoutMinutes: 5,
      idempotencyKey: "  key-1  ",
      metadata: { team: "core" },
      schedule: { kind: "interval", everyMinutes: 30 },
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.data).toMatchObject({
      name: "Daily report",
      description: "weekly",
      enabled: true,
      idempotencyKey: "key-1",
      metadata: { team: "core" },
      trigger: { kind: "interval", ms: 1_800_000 },
      action: {
        kind: "skill",
        instructions: "Summarize the day.",
        model: "openai/gpt-5",
        mcpTools: [{ server: "github", tool: "list_issues" }],
        workspaces: ["/repo"],
        permission: "auto",
        timeoutMs: 300_000,
      },
    })
  })

  test("builds an AgentUI action when agentId is set", () => {
    const plan = buildCreatePlan({
      ...base,
      agentId: "agent-1",
      schedule: { kind: "manual" },
    })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.data.action).toEqual({ kind: "agentui", agentId: "agent-1", message: "Summarize the day." })
  })

  test("rejects empty tool refs, out-of-range timeouts and skill-only fields on agent routines", () => {
    expect(
      buildCreatePlan({ ...base, tools: [{ server: "", tool: "x" }] }),
    ).toMatchObject({ ok: false, error: { details: { field: "tools" } } })
    expect(buildCreatePlan({ ...base, timeoutMinutes: 0 })).toMatchObject({
      ok: false,
      error: { details: { field: "timeoutMinutes" } },
    })
    expect(
      buildCreatePlan({ ...base, agentId: "agent-1", tools: [{ server: "github", tool: "x" }] }),
    ).toMatchObject({ ok: false, error: { details: { field: "tools" } } })
    expect(buildCreatePlan({ ...base, agentId: "agent-1", model: "openai/gpt-5" })).toMatchObject({
      ok: false,
      error: { details: { field: "model" } },
    })
  })

  test("detects duplicate name + trigger only", () => {
    const trigger = { kind: "cron" as const, expr: "0 9 * * *" }
    expect(sameRoutineKey({ name: "Daily", trigger }, " daily ", trigger)).toBe(true)
    expect(sameRoutineKey({ name: "Daily", trigger }, "Daily", { kind: "manual" })).toBe(false)
  })

  test("validates AgentUI model identifiers", () => {
    expect(validModel("openai/gpt-5")).toBe(true)
    expect(validModel("combo:fast")).toBe(true)
    expect(validModel("gpt-5")).toBe(false)
    expect(validModel("openai/")).toBe(false)
    expect(validModel("combo:")).toBe(false)
    expect(validModel("open ai/gpt-5")).toBe(false)
  })
})

describe("AgentUI create validation", () => {
  test("requires name, systemPrompt and model", () => {
    expect(buildAgentInput({ action: "create", systemPrompt: "x", model: "openai/gpt-5" })).toMatchObject({
      ok: false,
      error: { details: { field: "name" } },
    })
    expect(buildAgentInput({ action: "create", name: "x", model: "openai/gpt-5" })).toMatchObject({
      ok: false,
      error: { details: { field: "systemPrompt" } },
    })
    expect(buildAgentInput({ action: "create", name: "x", systemPrompt: "y" })).toMatchObject({
      ok: false,
      error: { details: { field: "model" } },
    })
  })

  test("builds defaults and capability flags", () => {
    const built = buildAgentInput(
      {
        action: "create",
        name: "  Helper  ",
        description: "  does things  ",
        systemPrompt: "  You help.  ",
        model: " openai/gpt-5 ",
        tools: ["github", ""],
        permissions: { routines: true, memory: true },
        commandTriggers: ["#"],
        visibility: "public",
      },
      "agent-1",
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.data).toMatchObject({
      id: "agent-1",
      name: "Helper",
      description: "does things",
      personality: "You help.",
      model: "openai/gpt-5",
      channels: [],
      commandTriggers: ["#"],
      ragSources: [],
      guardrails: { enabled: false, level: "basic" },
      mcpServers: ["github"],
      routinesEnabled: true,
      memoryEnabled: true,
      agendaEnabled: false,
      filesystemEnabled: false,
      terminalEnabled: false,
      whatsappEnabled: false,
      enabled: true,
      visibility: "public",
    })
  })

  test("defaults to enabled, private and no tools", () => {
    const built = buildAgentInput({
      action: "create",
      name: "x",
      systemPrompt: "y",
      model: "combo:fast",
    })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.data).toMatchObject({
      enabled: true,
      visibility: "private",
      mcpServers: [],
      commandTriggers: [],
    })
  })
})
