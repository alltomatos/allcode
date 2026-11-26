import { beforeAll, describe, expect, test } from "bun:test"

/**
 * Opt-in live parity check between the v1 provider projection and the v2
 * catalog, including one real prompt per configured provider/model.
 *
 * It is skipped unless `OPENCODE_PARITY_URL` is set. Run it against a dev
 * server that already has the operator's real providers connected:
 *
 *   OPENCODE_PARITY_URL=http://127.0.0.1:4096 \
 *   OPENCODE_PARITY_PROMPTS="openrouter/openrouter/free,opencode/gpt-6.2-sol" \
 *   bun test test/provider/parity-live.test.ts --timeout 180000
 *
 * The test preload deletes `OPENCODE_SERVER_*`, so always pass\n * `OPENCODE_PARITY_USERNAME`/`OPENCODE_PARITY_PASSWORD` explicitly.
 * `OPENCODE_PARITY_DIR` defaults to the current directory.
 */

const base = process.env.OPENCODE_PARITY_URL
const directory = process.env.OPENCODE_PARITY_DIR ?? process.cwd()
const username = process.env.OPENCODE_PARITY_USERNAME ?? "opencode"
const password = process.env.OPENCODE_PARITY_PASSWORD ?? ""
const authorization = password ? `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` : undefined
const prompts = (process.env.OPENCODE_PARITY_PROMPTS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => {
    const [providerID, ...rest] = item.split("/")
    return { providerID, modelID: rest.join("/") }
  })

const headers = {
  ...(authorization ? { authorization } : {}),
  "x-opencode-directory": directory,
  "content-type": "application/json",
}

async function json<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, { ...init, headers })
  const text = await response.text()
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${response.status}: ${text.slice(0, 400)}`)
  return (text ? JSON.parse(text) : undefined) as T
}

const query = (path: string) => `${path}${path.includes("?") ? "&" : "?"}directory=${encodeURIComponent(directory)}`

type V1Provider = {
  id: string
  models: Record<
    string,
    {
      status?: string
      cost?: { input: number; output: number }
      limit?: { context?: number; output?: number }
      capabilities?: { toolcall?: boolean; input?: Record<string, boolean>; output?: Record<string, boolean> }
    }
  >
}
type V1ProviderList = {
  all: V1Provider[]
  connected: string[]
  default: Record<string, string>
}
type V2Provider = { id: string }
type V2Model = {
  id: string
  providerID: string
  status?: string
  enabled?: boolean
  cost?: { input: number; output: number }[]
  limit?: { context?: number; output?: number }
  capabilities?: { tools?: boolean; input?: string[]; output?: string[] }
}

const live = base ? describe : describe.skip

live("live provider parity v1 x v2", () => {
  let v1: V1ProviderList
  let v2Providers: V2Provider[]
  let v2Models: V2Model[]
  let health: { providerParity?: boolean; providerParityReason?: string }

  const v1Pairs = () =>
    new Set(v1.all.flatMap((provider) => Object.keys(provider.models).map((model) => `${provider.id}/${model}`)))
  const v2Pairs = () => new Set(v2Models.map((model) => `${model.providerID}/${model.id}`))

  beforeAll(async () => {
    const [providerList, providers, models, healthResponse] = await Promise.all([
      json<{ data: V1ProviderList }>(query("/provider")),
      json<{ data: V2Provider[] }>(query("/api/provider")),
      json<{ data: V2Model[] }>(query("/api/model")),
      json<{ healthy: boolean; providerParity?: boolean; providerParityReason?: string }>("/api/health"),
    ])
    v1 = providerList as unknown as V1ProviderList
    v2Providers = providers.data
    v2Models = models.data
    health = healthResponse
  })

  test("C4: v2 exposes exactly the connected v1 providers", () => {
    expect(v2Providers.map((provider) => provider.id).sort()).toEqual([...v1.connected].sort())
  })

  test("C1: v2 exposes exactly the selectable v1 provider/model pairs", () => {
    expect([...v2Pairs()].sort()).toEqual([...v1Pairs()].sort())
  })

  test("C2: shared models keep status, limits and capabilities", () => {
    const byPair = new Map(v2Models.map((model) => [`${model.providerID}/${model.id}`, model]))
    for (const provider of v1.all) {
      for (const [modelID, model] of Object.entries(provider.models)) {
        const v2 = byPair.get(`${provider.id}/${modelID}`)
        if (!v2) continue
        expect({ provider: provider.id, model: modelID, enabled: v2.enabled }).toEqual({
          provider: provider.id,
          model: modelID,
          enabled: true,
        })
        if (model.capabilities?.toolcall !== undefined)
          expect({ pair: `${provider.id}/${modelID}`, tools: v2.capabilities?.tools }).toEqual({
            pair: `${provider.id}/${modelID}`,
            tools: model.capabilities.toolcall,
          })
        if (model.capabilities?.input)
          expect({ pair: `${provider.id}/${modelID}`, input: [...(v2.capabilities?.input ?? [])].sort() }).toEqual({
            pair: `${provider.id}/${modelID}`,
            input: Object.entries(model.capabilities.input)
              .filter(([, enabled]) => enabled)
              .map(([key]) => key)
              .sort(),
          })
        if (model.limit?.context !== undefined)
          expect({ pair: `${provider.id}/${modelID}`, context: v2.limit?.context }).toEqual({
            pair: `${provider.id}/${modelID}`,
            context: model.limit.context,
          })
      }
    }
  })

  test("C3: a session without a model runs with a v1 default", async () => {
    const created = await json<{ data: { id: string } }>(query("/api/session"), {
      method: "POST",
      body: JSON.stringify({ location: { directory } }),
    })
    await json(query(`/api/session/${created.data.id}/prompt`), {
      method: "POST",
      body: JSON.stringify({ prompt: { text: "Responda apenas: OK" } }),
    })
    const deadline = Date.now() + 90_000
    let assistant: { model?: { id: string; providerID: string }; time?: { completed?: unknown } } | undefined
    while (Date.now() < deadline) {
      const messages = await json<{
        data: { type: string; model?: { id: string; providerID: string }; time?: { completed?: unknown } }[]
      }>(query(`/api/session/${created.data.id}/message?order=asc`))
      assistant = messages.data.findLast((message) => message.type === "assistant" && message.time?.completed)
      if (assistant) break
      await Bun.sleep(500)
    }
    expect(assistant?.model).toBeDefined()
    expect(v1.default[assistant!.model!.providerID]).toBe(assistant!.model!.id)
  })

  test("C5: a persisted explicit model resolves to the same pair", async () => {
    const [pair] = [...v1Pairs()].filter((item) => v2Pairs().has(item))
    expect(pair).toBeDefined()
    const [providerID, ...rest] = pair.split("/")
    const modelID = rest.join("/")
    const created = await json<{ data: { id: string; model?: { id: string; providerID: string } } }>(
      query("/api/session"),
      {
        method: "POST",
        body: JSON.stringify({ model: { id: modelID, providerID }, location: { directory } }),
      },
    )
    const read = await json<{ data: { model?: { id: string; providerID: string } } }>(
      query(`/api/session/${created.data.id}`),
    )
    expect(read.data.model).toMatchObject({ id: modelID, providerID })
  })

  test.skipIf(prompts.length === 0)("prompts one model per configured provider on v1 and v2", async () => {
    for (const model of prompts) {
      const v1Session = await json<{ id: string }>(query("/session"), { method: "POST", body: "{}" })
      const v1Message = await json<{ info: { error?: unknown }; parts: { type: string; text?: string }[] }>(
        query(`/session/${v1Session.id}/message`),
        {
          method: "POST",
          body: JSON.stringify({
            model,
            parts: [{ type: "text", text: "Responda apenas: OK" }],
          }),
        },
      )
      expect({ pair: `${model.providerID}/${model.modelID}`, v1Error: v1Message.info.error }).toEqual({
        pair: `${model.providerID}/${model.modelID}`,
        v1Error: undefined,
      })
      expect(v1Message.parts.some((part) => part.type === "text" && part.text?.length)).toBeTrue()

      const v2Session = await json<{ data: { id: string } }>(query("/api/session"), {
        method: "POST",
        body: JSON.stringify({ model: { id: model.modelID, providerID: model.providerID }, location: { directory } }),
      })
      await json(query(`/api/session/${v2Session.data.id}/prompt`), {
        method: "POST",
        body: JSON.stringify({ prompt: { text: "Responda apenas: OK" } }),
      })
      const deadline = Date.now() + 90_000
      let assistant: { error?: unknown; content?: { type: string; text?: string }[] } | undefined
      while (Date.now() < deadline) {
        const messages = await json<{ data: { type: string; error?: unknown; content?: { type: string; text?: string }[]; time?: { completed?: unknown } }[] }>(
          query(`/api/session/${v2Session.data.id}/message?order=asc`),
        )
        assistant = messages.data.findLast((message) => message.type === "assistant" && message.time?.completed)
        if (assistant) break
        await Bun.sleep(500)
      }
      expect({ pair: `${model.providerID}/${model.modelID}`, v2Error: assistant?.error }).toEqual({
        pair: `${model.providerID}/${model.modelID}`,
        v2Error: undefined,
      })
      expect(assistant?.content?.some((part) => part.type === "text" && part.text?.length)).toBeTrue()
    }
  })

  test("parity is not announced while a gap exists", () => {
    const equal = [...v2Pairs()].sort().join() === [...v1Pairs()].sort().join()
    if (!equal) expect(health.providerParity).not.toBeTrue()
  })
})
