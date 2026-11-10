import { useServerSync } from "@/context/server-sync"
import { useTenantAuth } from "@/context/tenant-auth"
import { decode64 } from "@/utils/base64"
import type { NormalizedProviderListResponse } from "@allcode/session-ui/context"
import { useParams } from "@solidjs/router"
import { Iterable } from "effect"
import { createMemo, type Accessor } from "solid-js"
import { selectProviderCatalog } from "./provider-catalog"

export const popularProviders = [
  "omnrt",
  "opencode",
  "opencode-go",
  "anthropic",
  "openai",
  "google-antigravity",
  "google-antigravity-cli",
  "openrouter",
]
const popularProviderSet = new Set(popularProviders)

type ProviderPolicy = ReturnType<ReturnType<typeof useTenantAuth>["providerPolicy"]>

function isVisible(policy: ProviderPolicy, providerID: string) {
  if (!policy) return true
  if (policy.denied.includes(providerID)) return false
  const prov = (policy.provisioned ?? []).find((p) => p.id === providerID)
  if (prov && !prov.apiKey) return false
  if (!policy.restricted) return true
  return policy.allowLocal || policy.allowed.includes(providerID)
}

export function useProviders(directory: Accessor<string | undefined>) {
  const serverSync = useServerSync()
  const tenantAuth = useTenantAuth()
  const params = useParams()
  const dir = () => (directory ? directory() : decode64(params.dir))
  const policy = createMemo(() => tenantAuth.providerPolicy())

  // The raw catalog only changes when the directory, the project store or the
  // global provider store changes. Memoizing it avoids re-selecting (and
  // re-allocating) the catalog on every accessor call.
  const catalog = createMemo<NormalizedProviderListResponse>(() => {
    const value = dir()
    const projectStore = value ? serverSync().child(value)[0] : undefined
    const projectCatalog = projectStore && {
      ready: projectStore.provider_ready,
      providers: projectStore.provider,
    }
    // Só fixa no catálogo do projeto quando ele já está pronto. Enquanto o
    // child store não carregou (startup/auth race), usa o catálogo global em
    // vez de devolver uma lista vazia — era o que deixava o chat sem
    // provedores/modelos enquanto o AgentUI (global) continuava funcionando.
    if (value && projectStore?.provider_ready) {
      return selectProviderCatalog({
        explicit: true,
        directory: value,
        catalog: projectCatalog,
      })
    }
    return selectProviderCatalog({
      explicit: false,
      directory: value,
      catalog: projectCatalog,
      global: serverSync().data.provider,
    })
  })

  // Filtering by policy is the expensive part (it rebuilds the Map). Cache it
  // and reuse the original catalog when the policy hides nothing.
  const filtered = createMemo<NormalizedProviderListResponse>(() => {
    const current = policy()
    const value = catalog()
    if (!current) return value
    const entries = Array.from(value.all).filter(([providerID]) => isVisible(current, providerID))
    if (entries.length === value.all.size) return value
    return { ...value, all: new Map(entries) }
  })

  const all = createMemo(() => filtered().all)
  const defaults = createMemo(() => filtered().default)
  const defaultModel = createMemo(() => filtered().defaultModel)
  const connectedIDs = createMemo(() => new Set(filtered().connected))

  const connected = createMemo(() =>
    Array.from(
      Iterable.filter(
        Iterable.map(all(), ([, provider]) => provider),
        (provider) => connectedIDs().has(provider.id),
      ),
    ),
  )

  const popular = createMemo(() =>
    Array.from(
      Iterable.filter(
        Iterable.map(all(), ([, provider]) => provider),
        (provider) => popularProviderSet.has(provider.id),
      ),
    ),
  )

  const paid = createMemo(() => {
    const connected = connectedIDs()
    const providers = all()
    return Array.from(
      Iterable.filter(
        providers,
        ([id]) =>
          connected.has(id) && (id !== "opencode" || Object.keys(providers.get(id)?.models ?? {}).length > 0),
      ),
    )
  })

  return {
    all,
    default: defaults,
    defaultModel,
    popular,
    connected,
    paid,
  }
}
