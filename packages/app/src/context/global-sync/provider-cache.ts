import type { NormalizedProviderListResponse } from "@allcode/session-ui/context"

/**
 * Cache local do catálogo de providers.
 *
 * O catálogo leva alguns segundos para ficar pronto (boot dos plugins), então
 * guardamos o último snapshot **dos providers conectados** e o devolvemos como
 * `initialData` da query. A UI renderiza imediatamente com dados conhecidos e o
 * refresh em background substitui quando o servidor responde.
 *
 * Só conectados: o payload completo tem milhares de modelos e estouraria o
 * storage local sem ganho — o que importa no primeiro paint é o que o usuário
 * usa.
 */
const KEY = "opencode.providerCache.v1"
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_PROVIDERS = 24

type Snapshot = {
  at: number
  connected: string[]
  providers: unknown[]
  default: Record<string, string>
  defaultModel: { providerID: string; modelID: string } | null
}

type CacheFile = Record<string, Snapshot>

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

function read(): CacheFile {
  const store = storage()
  if (!store) return {}
  try {
    const value = store.getItem(KEY)
    if (!value) return {}
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? (parsed as CacheFile) : {}
  } catch {
    return {}
  }
}

function write(file: CacheFile) {
  const store = storage()
  if (!store) return
  try {
    store.setItem(KEY, JSON.stringify(file))
  } catch {
    // Storage cheio: o cache é otimização, nunca deve quebrar a UI.
  }
}

// Chave por diretório: o cache é uma dica de performance local, não uma
// autoridade por servidor.
export function cacheKey(directory: string | null) {
  return `dir::${directory ?? ""}`
}

export function readProviderCache(key: string): NormalizedProviderListResponse | undefined {
  const snapshot = read()[key]
  if (!snapshot) return undefined
  if (!Number.isFinite(snapshot.at) || Date.now() - snapshot.at > TTL_MS) return undefined
  if (!Array.isArray(snapshot.providers) || snapshot.providers.length === 0) return undefined

  return {
    all: new Map(snapshot.providers.map((provider) => [(provider as { id: string }).id, provider] as const)),
    connected: snapshot.connected,
    defaultModel: snapshot.defaultModel ?? null,
    default: snapshot.default,
  } as NormalizedProviderListResponse
}

export function writeProviderCache(key: string, value: NormalizedProviderListResponse) {
  const connected = new Set(value.connected)
  const providers = Array.from(value.all.entries())
    .filter(([id]) => connected.has(id))
    .slice(0, MAX_PROVIDERS)
    .map(([, provider]) => provider)

  const file = read()
  file[key] = {
    at: Date.now(),
    connected: [...value.connected],
    providers,
    default: Object.fromEntries(
      Object.entries(value.default).filter(([providerID]) => connected.has(providerID)),
    ),
    defaultModel: value.defaultModel ?? null,
  }
  write(file)
}

export function clearProviderCache() {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(KEY)
  } catch {
    // ignora
  }
}



