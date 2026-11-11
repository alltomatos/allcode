import { describe, expect, test } from "bun:test"
import { ModelV2 } from "@allcode/core/model"
import { ProviderV2 } from "@allcode/core/provider"
import { Provider } from "@/provider/provider"

// Contrato estrito C1-C5 (docs/agents/providers.md).
//
// Este harness compara, para o mesmo catálogo v2, o que a projeção v1 entrega
// com o que o catálogo declara. Ele é a gate da fase de projeção neutra: uma
// divergência em C1-C5 é falha, nunca delta.
//
// Fora do contrato: api.npm, api.url e api.settings (o v1 sintetiza
// `@ai-sdk/openai-compatible` onde o v2 declara native/aisdk). api.id fica
// dentro, porque é o modelo upstream que a chamada envia.

const provider = (id: string, request: { headers?: Record<string, string> } = {}) =>
  ProviderV2.Info.make({
    id: ProviderV2.ID.make(id),
    name: id,
    api: { type: "aisdk", package: "@ai-sdk/openai-compatible", url: `https://example.test/${id}` },
    request: { headers: request.headers ?? {}, body: {} },
  })

type ModelStatus = "active" | "alpha" | "beta" | "deprecated"

const model = (
  providerID: string,
  id: string,
  override: Partial<{
    enabled: boolean
    status: ModelStatus
    input: number
    output: number
    released: number
  }> = {},
) => {
  const base = ModelV2.Info.empty(ProviderV2.ID.make(providerID), ModelV2.ID.make(id))
  const baseCost = base.cost[0] ?? { input: 0, output: 0, cache: { read: 0, write: 0 } }
  return {
    ...base,
    enabled: override.enabled ?? base.enabled,
    status: override.status ?? base.status,
    cost: [
      {
        ...baseCost,
        input: override.input ?? baseCost.input,
        output: override.output ?? baseCost.output,
        cache: baseCost.cache ?? { read: 0, write: 0 },
      },
    ],
    time: { ...base.time, released: override.released ?? 1_700_000_000_000 },
  }
}

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000

const trueKeys = (flags: Record<string, boolean>) =>
  Object.entries(flags)
    .filter(([, on]) => on)
    .map(([key]) => key)
    .sort()

// C1 + C2 derivados da projeção v1.
function projectV1(info: Provider.Info) {
  return Object.keys(info.models)
    .sort()
    .map((id) => {
      const item = info.models[id]!
      return {
        id,
        apiID: item.api.id,
        status: item.status,
        cost: {
          input: round(item.cost.input),
          output: round(item.cost.output),
          read: round(item.cost.cache.read),
          write: round(item.cost.cache.write),
        },
        limit: { context: item.limit.context, input: item.limit.input ?? null, output: item.limit.output },
        tools: item.capabilities.toolcall,
        input: trueKeys(item.capabilities.input as unknown as Record<string, boolean>),
        output: trueKeys(item.capabilities.output as unknown as Record<string, boolean>),
      }
    })
}

// C1 + C2 esperados a partir do catálogo v2 (apenas modelos habilitados).
function expectFromCatalog(providerID: string, models: ReturnType<typeof model>[]) {
  return models
    .filter((item) => item.enabled)
    .map((item) => ({
      id: item.id as string,
      apiID: item.api.id as string,
      status: item.status,
      cost: {
        input: round(item.cost[0]!.input),
        output: round(item.cost[0]!.output),
        read: round(item.cost[0]!.cache.read),
        write: round(item.cost[0]!.cache.write),
      },
      limit: { context: item.limit.context, input: item.limit.input ?? null, output: item.limit.output },
      tools: item.capabilities.tools,
      input: [...item.capabilities.input].sort(),
      output: [...item.capabilities.output].sort(),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

describe("contrato estrito C1-C2 (modelos e flags)", () => {
  test("modelos habilitados aparecem e desabilitados não", () => {
    const item = provider("opencode-go")
    const models = [
      model("opencode-go", "beam-free", { enabled: true, input: 0 }),
      model("opencode-go", "deepseek-v4-pro", { enabled: false, input: 1.4 }),
    ]

    const info = Provider.fromCatalog(item, models)

    expect(projectV1(info).map((entry) => entry.id)).toEqual(["beam-free"])
    expect(projectV1(info)).toEqual(expectFromCatalog("opencode-go", models))
  })

  test("custo, limite e capabilities são preservados", () => {
    const item = provider("opencode")
    const models = [model("opencode", "glm-5.3-flash-free", { enabled: true, input: 0, output: 0 })]

    const info = Provider.fromCatalog(item, models)

    expect(projectV1(info)).toEqual(expectFromCatalog("opencode", models))
  })

  test("api.id é contrato; api.npm e api.url são transporte", () => {
    const item = provider("opencode-go")
    const native = {
      ...model("opencode-go", "longcat-2.5-free", { enabled: true }),
      api: { id: ModelV2.ID.make("longcat-upstream"), type: "native" as const, url: "https://upstream.test", settings: {} },
    }

    const info = Provider.fromCatalog(item, [native])

    expect(info.models["longcat-2.5-free"]!.api.id).toBe("longcat-upstream")
    // Transporte não faz parte do contrato; apenas garantimos que não vaza para C1-C2.
    expect(info.models["longcat-2.5-free"]!.api.npm).toBe("@ai-sdk/openai-compatible")
  })
})

describe("contrato C4 (headers de gateway)", () => {
  test("request.headers do provider são preservados em options.headers", () => {
    const item = provider("opencode", { headers: { "x-opencode-org-id": "wrk_test" } })

    const info = Provider.fromCatalog(item, [])

    expect(info.options.headers).toEqual({ "x-opencode-org-id": "wrk_test" })
  })
})

describe("contrato C3 (default)", () => {
  test("default do provider é o modelo habilitado mais recente", () => {
    const item = provider("opencode")
    const models = [
      model("opencode", "older-model", { enabled: true, released: 1_600_000_000_000 }),
      model("opencode", "newest-model", { enabled: true, released: 1_700_000_000_000 }),
    ]

    const info = Provider.fromCatalog(item, models)
    const v1Default = Provider.defaultModelIDs({ [item.id]: info })[item.id as string]
    const catalogDefault = [...models]
      .filter((entry) => entry.enabled)
      .sort((a, b) => b.time.released - a.time.released)[0]!.id

    expect(v1Default).toBe(catalogDefault)
  })

  test("default ignora modelos deprecated", () => {
    const item = provider("opencode")
    const models = [
      { ...model("opencode", "deprecated-newest", { enabled: true, released: 1_800_000_000_000 }), status: "deprecated" as const },
      model("opencode", "active-older", { enabled: true, released: 1_600_000_000_000 }),
    ]

    const info = Provider.fromCatalog(item, models)

    expect(Provider.defaultModelIDs({ [item.id]: info })[item.id as string]).toBe("active-older")
  })
})
