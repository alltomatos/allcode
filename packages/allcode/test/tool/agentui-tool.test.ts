import { describe, expect } from "bun:test"
import { AppNodeBuilder } from "@allcode/core/effect/app-node-builder"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { Effect } from "effect"
import { Agent } from "../../src/agent/agent"
import { AgentUIStore } from "../../src/agentui/store"
import { Config } from "../../src/config/config"
import { MessageID, SessionID } from "../../src/session/schema"
import { Storage } from "../../src/storage/storage"
import { AgentUITool } from "../../src/tool/agentui"
import { Tool } from "../../src/tool/tool"
import { Truncate } from "../../src/tool/truncate"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Config.node, Storage.node, Truncate.node, Agent.node, AgentUIStore.node]),
    [],
  ),
)

function makeCtx(): Tool.Context {
  return {
    sessionID: SessionID.descending(),
    messageID: MessageID.ascending(),
    agent: "build",
    abort: new AbortController().signal,
    messages: [],
    metadata() {
      return Effect.void
    },
    ask() {
      return Effect.void
    },
  }
}

const body = (result: { output: string }) => JSON.parse(result.output)

describe("agentui tool integration flow", () => {
  it.instance(
    "creates, lists and rejects duplicate AgentUI agents",
    () =>
      Effect.gen(function* () {
        const tool = yield* Tool.init(yield* AgentUITool)
        const execute = tool.execute as unknown as (
          args: unknown,
          ctx: Tool.Context,
        ) => Effect.Effect<{ output: string; metadata: Record<string, unknown> }>
        const ctx = makeCtx()

        const input = {
          action: "create",
          name: "Support helper",
          description: "Answers support questions.",
          systemPrompt: "You are a support assistant.",
          model: "openai/gpt-5",
          tools: ["github"],
          permissions: { routines: true, memory: true },
          commandTriggers: ["#help"],
          visibility: "public",
        }

        const created = yield* execute(input, ctx)
        expect(body(created)).toMatchObject({
          ok: true,
          data: { status: "created", group: "Agentes", groupUrl: "/agentui" },
        })
        const agentId = body(created).data.agentId as string
        expect(body(created).data.agentUrl).toBe(`/agentui/${agentId}/edit`)

        const stored = yield* (yield* AgentUIStore.Service).list()
        expect(stored).toHaveLength(1)
        expect(stored[0]).toMatchObject({
          id: agentId,
          name: "Support helper",
          description: "Answers support questions.",
          personality: "You are a support assistant.",
          model: "openai/gpt-5",
          mcpServers: ["github"],
          routinesEnabled: true,
          memoryEnabled: true,
          visibility: "public",
          enabled: true,
        })

        const duplicate = yield* execute(input, ctx)
        expect(body(duplicate)).toMatchObject({
          ok: false,
          error: { code: "AGENT_DUPLICATE", details: { existingId: agentId } },
        })

        const fetched = yield* execute({ action: "get", agentId }, ctx)
        expect(body(fetched)).toMatchObject({ ok: true, data: { id: agentId } })

        const missing = yield* execute({ action: "get", agentId: "nope" }, ctx)
        expect(body(missing)).toMatchObject({ ok: false, error: { code: "AGENT_NOT_FOUND" } })
      }),
    60_000,
  )
})
