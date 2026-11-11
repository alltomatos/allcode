import { describe, expect, test } from "bun:test"
import { ProviderV2 } from "@allcode/core/provider"
import { projectProviderView } from "@/provider/view"
import { ProviderTest } from "../fake/provider"
import type { Provider } from "@/provider/provider"

const id = (value: string) => ProviderV2.ID.make(value)

const info = (providerID: string, models: Provider.Model[]) =>
  ({
    id: id(providerID),
    name: providerID,
    source: "custom",
    env: [],
    options: {},
    models: Object.fromEntries(models.map((model) => [model.id, model])),
  }) as unknown as Provider.Info

const model = (providerID: string, modelID: string, input: number) =>
  ProviderTest.model({
    id: modelID as never,
    providerID: id(providerID),
    cost: { input, output: 0, cache: { read: 0, write: 0 } },
  })

const base = (
  overrides: Partial<Parameters<typeof projectProviderView>[0]> = {},
): Parameters<typeof projectProviderView>[0] => ({
  base: {},
  connected: {},
  catalog: [],
  availableCatalogIDs: [],
  activeIntegrationIDs: new Set<string>(),
  credentials: {},
  combos: [],
  ...overrides,
})

// F2 — este é o merge que decide o que `GET /provider` devolve. É aqui que a
// trilha v1 diverge do catálogo v2, não no transporte HTTP.
describe("projectProviderView", () => {
  test("provider só de catálogo é adicionado", () => {
    const view = projectProviderView(
      base({ catalog: [info("omnrt", [model("omnrt", "auto", 0)])] }),
    )

    expect(Object.keys(view.providers)).toEqual(["omnrt"])
  })

  test("catálogo substitui o models.dev quando o provider não está conectado", () => {
    const view = projectProviderView(
      base({
        base: { "opencode-go": info("opencode-go", [model("opencode-go", "paid", 1), model("opencode-go", "free", 0)]) },
        connected: {},
        catalog: [info("opencode-go", [model("opencode-go", "free", 0)])],
      }),
    )

    // D003: sem conexão a projeção só traz o que o catálogo permite.
    expect(Object.keys(view.providers["opencode-go"]!.models)).toEqual(["free"])
  })

  test("modelos gratuitos do catálogo são mesclados sem remover os existentes", () => {
    const view = projectProviderView(
      base({
        base: { opencode: info("opencode", [model("opencode", "known", 0)]) },
        connected: { opencode: info("opencode", [model("opencode", "known", 0)]) },
        catalog: [info("opencode", [model("opencode", "new-free", 0)])],
      }),
    )

    expect(Object.keys(view.providers["opencode"]!.models).sort()).toEqual(["known", "new-free"])
  })

  test("modelo pago do catálogo não entra na mescla", () => {
    const view = projectProviderView(
      base({
        base: { opencode: info("opencode", [model("opencode", "known", 0)]) },
        connected: { opencode: info("opencode", [model("opencode", "known", 0)]) },
        catalog: [info("opencode", [model("opencode", "paid", 1)])],
      }),
    )

    expect(Object.keys(view.providers["opencode"]!.models)).toEqual(["known"])
  })

  test("combo vira provider quando existem combos", () => {
    const view = projectProviderView(base({ combos: [{ id: "fast", name: "Fast" }] }))

    expect(view.providers["combo"]?.models["fast"]).toBeDefined()
    expect(view.connectedIDs).toContain("combo")
  })

  test("conexão conta por credencial, por integração e por disponibilidade no catálogo", () => {
    const view = projectProviderView(
      base({
        base: {
          byKey: info("byKey", []),
          byIntegration: info("byIntegration", []),
          byOauth: info("byOauth", []),
          byCatalog: info("byCatalog", []),
        },
        credentials: {
          byKey: { type: "api" },
          byOauth: { type: "oauth" },
        },
        activeIntegrationIDs: new Set(["byIntegration"]),
        availableCatalogIDs: ["byCatalog"],
      }),
    )

    expect(view.connectedIDs).toContain("byKey")
    expect(view.connectedIDs).toContain("byIntegration")
    expect(view.connectedIDs).toContain("byCatalog")
    // OAuth sem access token não conta como conectado.
    expect(view.connectedIDs).not.toContain("byOauth")
  })
})

