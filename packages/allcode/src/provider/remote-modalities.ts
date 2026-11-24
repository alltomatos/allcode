import { isRecord } from "@/util/record"
import type { Model } from "./provider"

export type RemoteModalities = { input: string[]; output: string[] }

const KNOWN = ["text", "audio", "image", "video", "pdf"] as const
type Known = (typeof KNOWN)[number]

function isKnown(value: string): value is Known {
  return (KNOWN as readonly string[]).includes(value)
}

function list(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const entries = value.filter((item): item is string => typeof item === "string").filter(isKnown)
  return entries.length ? Array.from(new Set(entries)) : undefined
}

/**
 * Lê as modalidades que o endpoint declara para um modelo. Aceita os três
 * formatos publicados por gateways OpenAI-compatible: `modalities.input`
 * (DontStop), `input_modalities` (OmniRoute/OpenRouter) e
 * `capabilities.input`. Retorna undefined quando o modelo não declara nada
 * reconhecível — nunca inventa capacidades.
 */
export function readModalities(entry: Record<string, unknown>): RemoteModalities | undefined {
  const modalities = isRecord(entry.modalities) ? entry.modalities : undefined
  const capabilities = isRecord(entry.capabilities) ? entry.capabilities : undefined
  const input =
    list(modalities?.input) ?? list(entry.input_modalities) ?? list(capabilities?.input) ?? undefined
  const output =
    list(modalities?.output) ?? list(entry.output_modalities) ?? list(capabilities?.output) ?? undefined
  if (!input && !output) return undefined
  return { input: input ?? [], output: output ?? [] }
}

/** Extrai `{ id → modalidades }` de um payload `GET /models`. */
export function parseModelsPayload(payload: unknown): Map<string, RemoteModalities> {
  const body = isRecord(payload) ? payload : undefined
  if (!Array.isArray(body?.data)) return new Map()
  const result = new Map<string, RemoteModalities>()
  for (const item of body.data) {
    const entry = isRecord(item) ? item : undefined
    if (!entry || typeof entry.id !== "string" || !entry.id) continue
    const modalities = readModalities(entry)
    if (!modalities) continue
    result.set(entry.id, modalities)
  }
  return result
}

function flags(values: readonly string[]) {
  return {
    text: values.includes("text"),
    audio: values.includes("audio"),
    image: values.includes("image"),
    video: values.includes("video"),
    pdf: values.includes("pdf"),
  }
}

/**
 * Sobrepõe as modalidades reais do endpoint nos modelos do provider.
 *
 * A união é intencional: o endpoint é a fonte de verdade do que o modelo
 * aceita, mas nunca removemos uma capacidade declarada na configuração —
 * assim a correção só adiciona modalidades e não regride nada. Modelos que o
 * endpoint não lista ficam intactos.
 */
export function applyRemoteModalities(input: {
  models: Record<string, Model>
  remote: ReadonlyMap<string, RemoteModalities>
}): string[] {
  const updated: string[] = []
  for (const [modelID, model] of Object.entries(input.models)) {
    const remote = input.remote.get(modelID) ?? input.remote.get(model.api.id)
    if (!remote) continue
    const next = flags(remote.input)
    if (!Object.values(next).some(Boolean)) continue
    const current = model.capabilities.input
    model.capabilities.input = {
      text: current.text || next.text,
      audio: current.audio || next.audio,
      image: current.image || next.image,
      video: current.video || next.video,
      pdf: current.pdf || next.pdf,
    }
    if (remote.output.length) {
      const output = flags(remote.output)
      const existing = model.capabilities.output
      model.capabilities.output = {
        text: existing.text || output.text,
        audio: existing.audio || output.audio,
        image: existing.image || output.image,
        video: existing.video || output.video,
        pdf: existing.pdf || output.pdf,
      }
    }
    model.capabilities.attachment =
      model.capabilities.input.audio ||
      model.capabilities.input.image ||
      model.capabilities.input.video ||
      model.capabilities.input.pdf
    updated.push(modelID)
  }
  return updated
}

const SUCCESS_TTL_MS = 5 * 60_000
const FAILURE_TTL_MS = 60_000
// This runs while the provider list is being built, so a slow gateway must not
// hold the catalog hostage. `/models` is a cheap endpoint; 1.5s is generous.
const REQUEST_TIMEOUT_MS = 1_500

type CacheEntry = { at: number; models: Map<string, RemoteModalities>; ttl: number }

const cache = new Map<string, CacheEntry>()

function baseURLOf(url: string) {
  return url.replace(/\/+$/, "")
}

export function clearRemoteModalitiesCache() {
  cache.clear()
}

/**
 * Busca as modalidades em `GET {baseURL}/models`. Best-effort com cache:
 * gateway offline ou chave inválida não pode travar nem esvaziar o catálogo.
 */
export async function fetchRemoteModalities(input: {
  baseURL: string
  apiKey?: string
  headers?: Record<string, string>
  fetch?: typeof globalThis.fetch
}): Promise<Map<string, RemoteModalities>> {
  const baseURL = baseURLOf(input.baseURL)
  if (!baseURL) return new Map()

  const key = `${baseURL}\u0000${input.apiKey ?? ""}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cached.ttl) return cached.models

  const fetchFn = input.fetch ?? globalThis.fetch
  const headers: Record<string, string> = { Accept: "application/json", ...input.headers }
  if (input.apiKey) headers.Authorization = `Bearer ${input.apiKey}`

  try {
    const response = await fetchFn(`${baseURL}/models`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) {
      cache.set(key, { at: Date.now(), models: new Map(), ttl: FAILURE_TTL_MS })
      return new Map()
    }
    const models = parseModelsPayload(await response.json())
    cache.set(key, { at: Date.now(), models, ttl: SUCCESS_TTL_MS })
    return models
  } catch {
    cache.set(key, { at: Date.now(), models: new Map(), ttl: FAILURE_TTL_MS })
    return new Map()
  }
}

export * as ProviderRemoteModalities from "./remote-modalities"
