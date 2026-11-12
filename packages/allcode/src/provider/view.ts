import { ProviderV2 } from "@allcode/core/provider"
import { Provider } from "./provider"

/**
 * Monta a lista pública de providers (contrato v1) a partir das três fontes
 * que o endpoint `GET /provider` combina: catálogo estático (models.dev já
 * convertido), estado vivo do `Provider.Service` e a projeção do catálogo v2.
 *
 * Extraído do handler para ser verificável sem subir HTTP — é aqui que mora a
 * divergência entre as trilhas, não no transporte.
 */
export function projectProviderView(input: {
  base: Record<string, Provider.Info>
  connected: Record<string, Provider.Info>
  catalog: readonly Provider.Info[]
  availableCatalogIDs: Iterable<string>
  activeIntegrationIDs: ReadonlySet<string>
  credentials: Record<string, unknown>
  combos: readonly { id: string; name: string }[]
}) {
  const availableCatalogIDs = new Set(input.availableCatalogIDs)
  const providers: Record<string, Provider.Info> = Object.assign(
    {},
    input.base,
    input.connected,
    Object.fromEntries(input.catalog.filter((item) => !(item.id in input.connected)).map((item) => [item.id, item])),
  )

  for (const catalogItem of input.catalog) {
    const managed =
      input.activeIntegrationIDs.has(catalogItem.id) ||
      catalogItem.id === "opencode" ||
      catalogItem.id.startsWith("opencode-")
    if (!managed) continue
    const existing = providers[catalogItem.id]
    if (!existing) {
      providers[catalogItem.id] = catalogItem
      continue
    }
    // O catálogo é autoritativo sobre o que pode ser ofertado: `enabled` já
    // embute "pago sem credencial". Antes filtrávamos por `cost.input !== 0`
    // aqui, o que escondia modelos pagos legítimos quando a credencial vinha da
    // integração (o loader v1 só enxerga auth.json/config/env) — era a
    // divergência 12 vs 87 do `opencode`.
    const models = { ...existing.models }
    for (const [id, model] of Object.entries(catalogItem.models)) {
      if (model.status === "deprecated") continue
      models[id] = model
    }
    providers[catalogItem.id] = { ...existing, models }
  }

  if (input.combos.length > 0) {
    providers["combo"] = {
      id: ProviderV2.ID.make("combo"),
      name: "Combos",
      models: Object.fromEntries(
        input.combos.map((c) => [
          c.id,
          {
            id: c.id,
            name: c.name,
            providerID: "combo",
            capabilities: {
              tools: true,
              temperature: true,
              vision: true,
              reasoning: true,
              input: { text: true },
              output: { text: true },
            },
          } as never,
        ]),
      ),
      source: "custom",
      env: [],
      options: {},
    }
  }

  const connectedIDs = Object.keys(providers).filter((id) => {
    if (id === "combo") return input.combos.length > 0
    if (input.activeIntegrationIDs.has(id)) return true
    const credential = input.credentials[id] as { type?: string; access?: string } | undefined
    if (credential && credential.type !== "oauth") return true
    if (credential && credential.type === "oauth" && credential.access) return true
    const live = input.connected[id] as
      | { key?: string; options?: { apiKey?: string; accessToken?: string } }
      | undefined
    if (live?.key && live.key !== "opencode-oauth-dummy-key") return true
    if (live?.options?.apiKey || live?.options?.accessToken) return true
    if (availableCatalogIDs.has(id)) return true
    return false
  })

  return { providers, connectedIDs }
}

export * as ProviderView from "./view"
