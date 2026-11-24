import { createMemo, createResource, type Accessor } from "solid-js"
import type { IntegrationInfo } from "@allcode/client/promise"
import { useServerSDK } from "@/context/server-sdk"
import { createIntegrationFetchApi } from "@/utils/integration-fetch"
import { popularProviders, useProviders } from "./use-providers"

/**
 * Catálogo usado pelas telas de *conectar* provedor.
 *
 * `GET /provider` devolve apenas provedores conectados (e os modelos deles),
 * então a lista de provedores disponíveis para conectar não pode mais vir
 * dele. Vem do catálogo de integrações, que é independente de credencial e
 * barato (~44 KB). Provedores já conectados continuam vindo do estado vivo
 * para preservar nome/flags como o resto do app enxerga.
 */
export function useConnectableProviders(directory: Accessor<string | undefined>) {
  const serverSDK = useServerSDK()
  const providers = useProviders(directory)

  const [integrations] = createResource(
    () => ({ server: serverSDK().server.http, directory: directory() }),
    (input) =>
      createIntegrationFetchApi(input.server)
        .integration.list({ location: input.directory ? { directory: input.directory } : undefined })
        .then((res) => res.data ?? [])
        .catch(() => [] as IntegrationInfo[]),
  )

  return createMemo(() => {
    const catalog = new Map<string, { id: string; name: string }>()
    for (const provider of providers.all().values()) catalog.set(provider.id, { id: provider.id, name: provider.name })
    for (const integration of integrations() ?? []) {
      if (catalog.has(integration.id)) continue
      catalog.set(integration.id, { id: integration.id, name: integration.name })
    }
    return catalog
  })
}

/** Provedores populares na ordem canônica, lidos do catálogo conectável. */
export function connectablePopular(catalog: ReadonlyMap<string, { id: string; name: string }>) {
  return popularProviders.flatMap((id) => {
    const item = catalog.get(id)
    return item ? [item] : []
  })
}
