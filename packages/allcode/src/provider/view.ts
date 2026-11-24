import { ProviderV2 } from "@allcode/core/provider"
import { Provider } from "./provider"

export type ConnectionInput = {
  /** Estado vivo do `Provider.Service`: só contém providers com credencial resolvida. */
  connected: Record<string, Provider.Info>
  /** IDs que o catálogo v2 considera disponíveis (integração conectada ou sem integração). */
  availableCatalogIDs: Iterable<string>
  /** Providers com credencial persistida (`Credential.Service`). */
  activeIntegrationIDs: ReadonlySet<string>
  /** Credenciais do `auth.json`. */
  credentials: Record<string, unknown>
  combos: readonly { id: string }[]
}

/**
 * Critério único de "provedor conectado" usado tanto pelo filtro antecipado do
 * handler quanto pela projeção da lista pública. Um provider só entra em
 * `GET /provider` se `connectionPredicate(...)` disser que ele está conectado.
 *
 * A decisão é deliberadamente independente do catálogo models.dev: ela olha
 * apenas para credencial/integração/estado vivo, então pode rodar antes de
 * qualquer conversão cara (`fromModelsDevProvider`, `fromCatalog`,
 * `toPublicInfo`, encode).
 */
export function connectionPredicate(input: ConnectionInput) {
  const availableCatalogIDs = new Set(input.availableCatalogIDs)
  return (id: string) => {
    if (id === "combo") return input.combos.length > 0
    // O loader v1 só materializa em `Provider.Service` providers que têm
    // credencial de env/auth, entrada de config (ex.: endpoint local sem
    // chave) ou loader de plugin. Presença ali é o sinal mais forte de
    // "existe conexão/config válida" — sem ela, provedores customizados e
    // locais ficariam de fora.
    if (input.connected[id]) return true
    if (input.activeIntegrationIDs.has(id)) return true
    const credential = input.credentials[id] as { type?: string; access?: string } | undefined
    if (credential && credential.type !== "oauth") return true
    if (credential && credential.type === "oauth" && credential.access) return true
    return availableCatalogIDs.has(id)
  }
}

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

  const connectedIDs = Object.keys(providers).filter(
    connectionPredicate({
      connected: input.connected,
      availableCatalogIDs,
      activeIntegrationIDs: input.activeIntegrationIDs,
      credentials: input.credentials,
      combos: input.combos,
    }),
  )

  return { providers, connectedIDs }
}

export * as ProviderView from "./view"
