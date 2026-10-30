import crypto from "node:crypto"
import { Database as CoreDatabase } from "@allcode/core/database/database"
import { IntegrationRotation } from "@allcode/core/integration/rotation"
import { Integration } from "@allcode/core/integration"

// The Code Assist backend does not expose the same model IDs to both OAuth
// clients. Measured against the live endpoint: the IDE profile accepts the
// `-low/-medium/-high` variants directly, while the CLI profile only serves
// the `-tiered` alias (everything else answers 404 NOT_FOUND). Aliasing
// unconditionally made the IDE take the slower auto-routed tier even when the
// caller picked an explicit thinking level, so the alias is only a fallback
// there and a primary for CLI.
const MODEL_ALIASES: Record<string, string> = {
  "gemini-3.8-flash-high": "gemini-3.8-flash-tiered",
  "gemini-3.8-flash-medium": "gemini-3.8-flash-tiered",
  "gemini-3.8-flash-low": "gemini-3.8-flash-tiered",
  "gemini-3.7-flash-high": "gemini-3.7-flash-tiered",
  "gemini-3.7-flash-medium": "gemini-3.7-flash-tiered",
  "gemini-3.7-flash-low": "gemini-3.7-flash-tiered",
  "gemini-3.1-pro-high": "gemini-pro-agent",
}

const ANTIGRAVITY_BASE_URLS = [
  "https://daily-cloudcode-pa.googleapis.com",
  "https://cloudcode-pa.googleapis.com",
  "https://daily-cloudcode-pa.sandbox.googleapis.com",
]

// Runs that go silent for this long are treated as stalled and aborted so the
// SDK surfaces an error instead of waiting forever. Long thinking on a huge
// context can legitimately delay the first byte, so the default is generous
// and env-overridable.
const STREAM_IDLE_TIMEOUT_MS = Number(process.env.AGY_STREAM_IDLE_TIMEOUT_MS ?? 150_000)
// Only turns that took longer than this get a latency line by default; set
// AGY_LATENCY_LOG=1 to log every turn or AGY_LATENCY_LOG=0 to stay silent.
const SLOW_TURN_MS = 10_000

// Models already observed answering 404 on their literal ID for a profile.
// Once known, the doomed first attempt is skipped and the alias goes straight
// to the wire.
const aliasRequired = new Map<"ide" | "cli", Set<string>>()
// Last base URL that answered 2xx, so unrelated endpoints are not probed again.
const preferredBaseUrl: Record<"ide" | "cli", string | undefined> = { ide: undefined, cli: undefined }

function modelCandidates(profile: "ide" | "cli", rawModel: string): string[] {
  const alias = MODEL_ALIASES[rawModel]
  if (!alias) return [rawModel]
  if (aliasRequired.get(profile)?.has(rawModel)) return [alias]
  return [...new Set(profile === "cli" ? [alias, rawModel] : [rawModel, alias])]
}

function orderedBaseUrls(profile: "ide" | "cli"): string[] {
  const preferred = preferredBaseUrl[profile]
  if (!preferred) return ANTIGRAVITY_BASE_URLS
  return [preferred, ...ANTIGRAVITY_BASE_URLS.filter((url) => url !== preferred)]
}

const ANTIGRAVITY_IDE_VERSION = "2.11.0"

const CLIENT_CONFIGS = {
  ide: {
    id: process.env.ANTIGRAVITY_OAUTH_CLIENT_ID ?? "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    secret: process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET ?? "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",
    userAgent: `antigravity/ide/${ANTIGRAVITY_IDE_VERSION} darwin/arm64`,
  },
  cli: {
    id: process.env.AGY_OAUTH_CLIENT_ID ?? process.env.ANTIGRAVITY_OAUTH_CLIENT_ID ?? "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    secret: process.env.AGY_OAUTH_CLIENT_SECRET ?? process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET ?? "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",
    userAgent: "antigravity/cli/1.1.5 (aidev_client; os_type=darwin; arch=arm64; auth_method=consumer)",
  },
}

function uuidFromSeed(seed: string): string {
  const bytes = crypto.createHash("sha256").update(seed).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function buildIdeRequestId(sessionId: string, model: string, count: number): string {
  const conversationId = uuidFromSeed(`antigravity:conversation:${sessionId}`)
  const trajectoryId = uuidFromSeed(`antigravity:trajectory:${sessionId}:${model}:agent`)
  const step = Math.max(1, count * 2 - 1)
  return `agent/${conversationId}/${Date.now()}/${trajectoryId}/${step}`
}

// Google reports remaining quota as a 0-1 fraction per bucket; we bench an
// account 5 points before it actually hits 100% so an in-flight request
// doesn't race the last sliver of quota and come back as a real 429.
const QUOTA_BENCH_THRESHOLD = 0.05
// retrieveUserQuota is called on (roughly) every chat message via
// getLiveToken, so it needs a short TTL cache to avoid doubling Google API
// traffic per message; quota doesn't change fast enough for 60-120s of
// staleness to matter here.
const QUOTA_CHECK_TTL_MS = 90_000
const quotaLastCheckedAt = new Map<string, number>()

let DatabaseConstructor: any

async function getDb(dbFile: string) {
  if (DatabaseConstructor) return new DatabaseConstructor(dbFile)
  if (typeof (process.versions as any).bun !== "undefined") {
    const mod = await import("bun:sqlite")
    DatabaseConstructor = class BunDbWrapper {
      db: any
      constructor(file: string) {
        this.db = new mod.Database(file)
      }
      prepare(sql: string) {
        const query = this.db.query(sql)
        return {
          all: (...args: any[]) => query.all(...args),
          run: (...args: any[]) => query.run(...args),
        }
      }
    }
  } else {
    const mod = await import("node:sqlite")
    DatabaseConstructor = mod.DatabaseSync
  }
  return new DatabaseConstructor(dbFile)
}

function toConnection(connectionId: string) {
  return { type: "credential" as const, id: connectionId as any, label: connectionId }
}

/** Parses a Google resetTime (epoch seconds/millis or ISO string) into epoch ms. */
function parseResetTimeMs(resetValue: unknown): number | null {
  try {
    if (typeof resetValue === "number") return resetValue < 1e12 ? resetValue * 1000 : resetValue
    if (typeof resetValue === "string") {
      if (/^\d+$/.test(resetValue)) {
        const ts = Number(resetValue)
        return ts < 1e12 ? ts * 1000 : ts
      }
      const parsed = Date.parse(resetValue)
      return Number.isNaN(parsed) ? null : parsed
    }
  } catch {}
  return null
}

/**
 * Proactively checks a connection's Google-reported quota and benches it
 * (via IntegrationRotation) if any bucket is at or below the threshold, so
 * `pick()` routes around it before it hits a real 429. Fails open: any
 * network/parse error, or Google simply not reporting `remainingFraction`
 * for a bucket, is treated as "unknown" and never benches the account.
 */
async function checkQuotaAndBenchIfLow(
  profile: "ide" | "cli",
  connectionId: string,
  token: string,
  projectID: string,
): Promise<void> {
  if (!token) return
  const lastChecked = quotaLastCheckedAt.get(connectionId)
  if (lastChecked !== undefined && Date.now() - lastChecked < QUOTA_CHECK_TTL_MS) return
  quotaLastCheckedAt.set(connectionId, Date.now())

  try {
    const client = CLIENT_CONFIGS[profile]
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": client.userAgent,
      Authorization: `Bearer ${token}`,
    }

    let data: any
    for (const baseUrl of ANTIGRAVITY_BASE_URLS) {
      try {
        const res = await fetch(`${baseUrl}/v1internal:retrieveUserQuota`, {
          method: "POST",
          headers,
          body: JSON.stringify({ project: projectID }),
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) continue
        data = await res.json()
        break
      } catch {
        continue
      }
    }
    if (!data || !Array.isArray(data.buckets)) return

    for (const bucket of data.buckets) {
      const rawFraction = bucket?.remainingFraction
      // Field absent (fractionReported=false in OmniRoute's terms) means
      // Google didn't report this bucket's usage, not that it's at 0%.
      if (typeof rawFraction !== "number") continue
      if (rawFraction > QUOTA_BENCH_THRESHOLD) continue

      const resetAtMs = parseResetTimeMs(bucket?.resetTime)
      const durationMs = resetAtMs && resetAtMs > Date.now() ? resetAtMs - Date.now() : 15 * 60_000
      IntegrationRotation.markUnavailable(toConnection(connectionId), durationMs)
      return
    }
  } catch {
    // Fail open — a broken quota probe must never bench an otherwise-healthy account.
  }
}

const inFlightRefreshes = new Map<string, Promise<{ token?: string; projectID?: string; error?: string }>>()

async function refreshAccountToken(
  connectionId: string,
  profile: "ide" | "cli",
): Promise<{ token?: string; projectID?: string; error?: string }> {
  const existing = inFlightRefreshes.get(connectionId)
  if (existing) return existing

  const promise = (async () => {
    try {
      const dbFile = CoreDatabase.path()
      const db = await getDb(dbFile)
      const row = db.prepare("SELECT value FROM credential WHERE id = ?").get(connectionId) as { value: string } | undefined
      if (!row) return { error: "Credential not found" }

      const parsed = JSON.parse(row.value)
      if (!parsed.refresh) return { error: "No refresh token available" }

      const client = CLIENT_CONFIGS[profile]
      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: parsed.refresh,
        client_id: client.id,
        client_secret: client.secret,
      })

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        return { error: errText || `Refresh failed with status ${res.status}` }
      }

      const refreshed = (await res.json()) as {
        access_token: string
        refresh_token?: string
        expires_in: number
      }

      parsed.access = refreshed.access_token
      if (typeof refreshed.refresh_token === "string" && refreshed.refresh_token.trim()) {
        parsed.refresh = refreshed.refresh_token.trim()
      }
      parsed.expires = Date.now() + refreshed.expires_in * 1000

      db.prepare("UPDATE credential SET value = ?, time_updated = ? WHERE id = ?").run(
        JSON.stringify(parsed),
        Date.now(),
        connectionId,
      )

      return { token: refreshed.access_token, projectID: parsed.metadata?.projectID || "aicode-consumers" }
    } catch (err) {
      return { error: String(err) }
    }
  })().finally(() => {
    inFlightRefreshes.delete(connectionId)
  })

  inFlightRefreshes.set(connectionId, promise)
  return promise
}

// Background proactive token refresh — runs every 5 minutes and refreshes accounts expiring in < 30 minutes
const BACKGROUND_REFRESH_LEAD_MS = 30 * 60 * 1000
let backgroundRefreshStarted = false

export function ensureBackgroundTokenRefresh() {
  if (backgroundRefreshStarted) return
  backgroundRefreshStarted = true

  const tick = async () => {
    try {
      const dbFile = CoreDatabase.path()
      const db = await getDb(dbFile)
      const rows = db
        .prepare("SELECT id, value, integration_id FROM credential WHERE integration_id IN ('google-antigravity-cli', 'google-antigravity')")
        .all() as { id: string; value: string; integration_id: string }[]

      const now = Date.now()
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.value)
          if (!parsed.refresh) continue
          const expires = parsed.expires as number | undefined
          // Refresh if expires in less than 30 minutes, or missing expiration time
          if (!expires || expires - now < BACKGROUND_REFRESH_LEAD_MS) {
            const profile: "ide" | "cli" = row.integration_id === "google-antigravity" ? "ide" : "cli"
            await refreshAccountToken(row.id, profile)
          }
        } catch {
          // Ignore parse errors per row
        }
      }
    } catch {
      // Fail-open for entire background tick
    }
  }

  // Run immediate tick on boot, then repeat every 5 minutes
  void tick()
  const timer = setInterval(() => void tick(), 5 * 60 * 1000)
  if (typeof timer.unref === "function") timer.unref()
}

export async function getLiveToken(
  integrationID: string,
  profile: "ide" | "cli",
): Promise<{ token: string; projectID: string; connectionId?: string; exhausted?: boolean }> {
  ensureBackgroundTokenRefresh()
  try {
    const dbFile = CoreDatabase.path()
    const db = await getDb(dbFile)
    const rawRows = db
      .prepare("SELECT id, label, value, disabled, time_updated, time_created FROM credential WHERE integration_id = ? ORDER BY time_updated DESC, time_created DESC")
      .all(integrationID) as { id: string; label: string; value: string; disabled?: number | boolean; time_updated?: number; time_created?: number }[]
    if (!rawRows.length) return { token: "", projectID: "aicode-consumers" }

    // Deduplicate in memory by email / label
    const seen = new Set<string>()
    const rows: { id: string; value: string; disabled?: boolean }[] = []
    for (const r of rawRows) {
      const isDisabled = r.disabled === 1 || r.disabled === true
      try {
        const p = JSON.parse(r.value)
        const email = p?.metadata?.email || r.label
        if (email && seen.has(email)) continue
        if (email) seen.add(email)
        rows.push({ id: r.id, value: r.value, disabled: isDisabled })
      } catch {
        rows.push({ id: r.id, value: r.value, disabled: isDisabled })
      }
    }

    // Convert rows to IntegrationConnection format for rotation picker
    const connections = rows.map((r) => ({
      type: "credential" as const,
      id: r.id as any,
      label: r.id,
      disabled: r.disabled,
    }))

    if (connections.every((c) => !IntegrationRotation.isAvailable(c))) {
      return { token: "", projectID: "aicode-consumers", exhausted: true }
    }

    const availableConnections = connections.filter((c) => IntegrationRotation.isAvailable(c))
    const picked = IntegrationRotation.pick(Integration.ID.make(integrationID), availableConnections)
    const selectedId = picked?.type === "credential" ? picked.id : availableConnections[0]?.id
    const selectedRow = rows.find((r) => r.id === selectedId) ?? rows[0]

    const parsed = JSON.parse(selectedRow.value)
    const now = Date.now()
    let access = parsed.access as string
    const projectID = parsed.metadata?.projectID || "aicode-consumers"

    // If token expires in less than 5 minutes (or expired/missing expiry), refresh proactively
    if (parsed.refresh && (!parsed.expires || parsed.expires - now < 300_000)) {
      const refreshed = await refreshAccountToken(selectedRow.id, profile)
      if (refreshed.token) {
        access = refreshed.token
      }
    }

    // Deliberately not awaited: the probe hits up to three endpoints with an
    // 8s timeout each, and it used to sit on the critical path of every
    // message once the 90s TTL expired. A real 429 still benches the account
    // through benchConnectionOnFailure, so this is only an early-warning hop.
    void checkQuotaAndBenchIfLow(profile, selectedRow.id, access, projectID)

    return { token: access, projectID, connectionId: selectedRow.id }
  } catch {
    return { token: "", projectID: "aicode-consumers" }
  }
}

interface StreamTiming {
  profile: "ide" | "cli"
  model: string
  startedAt: number
  firstChunkAt?: number
  lastChunkAt: number
  chunks: number
  bytes: number
  maxGapMs: number
}

function logStreamTiming(timing: StreamTiming, outcome: string) {
  const mode = process.env.AGY_LATENCY_LOG
  if (mode === "0") return
  const total = Date.now() - timing.startedAt
  const failed = outcome !== "closed" && outcome !== "cancelled"
  if (mode !== "1" && !failed && total < SLOW_TURN_MS) return
  const ttfb = timing.firstChunkAt ? timing.firstChunkAt - timing.startedAt : -1
  console.debug(
    `[agy] stream profile=${timing.profile} model=${timing.model} ttfb=${ttfb}ms total=${total}ms chunks=${timing.chunks} bytes=${timing.bytes} maxGap=${Math.round(timing.maxGapMs)}ms outcome=${outcome}`,
  )
}

/**
 * Aborts the response body when the upstream goes silent for longer than the
 * timeout. Google sometimes holds an entire turn open without emitting a byte
 * (the "thinking then nothing" stalls); without this guard the run waits
 * forever instead of failing and letting the caller retry.
 */
export function createIdleGuard(timeoutMs: number, onTimeout: (error: Error) => void): TransformStream<Uint8Array, Uint8Array> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = (controller: TransformStreamDefaultController<Uint8Array>) => {
    if (timeoutMs <= 0) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const error = new Error(`Antigravity stream stalled for ${timeoutMs}ms`)
      onTimeout(error)
      controller.error(error)
    }, timeoutMs)
  }
  return new TransformStream<Uint8Array, Uint8Array>({
    start(controller) {
      arm(controller)
    },
    transform(chunk, controller) {
      arm(controller)
      controller.enqueue(chunk)
    },
    flush() {
      if (timer) clearTimeout(timer)
    },
  })
}

export function createSseTransform(timing: StreamTiming): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ""

  const emit = (controller: TransformStreamDefaultController<Uint8Array>, line: string) => {
    const trimmed = line.trim()
    if (!trimmed) {
      controller.enqueue(encoder.encode("\n"))
      return
    }
    if (!trimmed.startsWith("data: ")) {
      controller.enqueue(encoder.encode(`${line}\n`))
      return
    }
    const dataContent = trimmed.slice(6).trim()
    if (dataContent === "[DONE]") {
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      return
    }
    try {
      const parsed = JSON.parse(dataContent)
      for (const chunk of Array.isArray(parsed) ? parsed : [parsed]) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(unwrapAntigravityChunk(chunk))}\n\n`))
      }
    } catch {
      controller.enqueue(encoder.encode(`${line}\n`))
    }
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(value, controller) {
      const now = Date.now()
      if (!timing.firstChunkAt) {
        timing.firstChunkAt = now
      } else {
        timing.maxGapMs = Math.max(timing.maxGapMs, now - timing.lastChunkAt)
      }
      timing.lastChunkAt = now
      timing.chunks++
      timing.bytes += value.byteLength
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) emit(controller, line)
    },
    flush(controller) {
      // Flush a trailing frame that arrived without a final newline.
      buffer += decoder.decode()
      if (buffer.trim()) emit(controller, buffer)
      buffer = ""
    },
  })
}

type AntigravityCandidate = Record<string, any>

function unwrapAntigravityChunk(parsed: any): any {
  if (Array.isArray(parsed)) {
    return parsed.map((item) => item?.response ?? item)
  }
  return parsed?.response ?? parsed
}

/**
 * Merges incremental `candidates[]` payloads from a streamed generateContent
 * response into the single-candidate shape a non-streaming caller expects.
 *
 * Google sends each text fragment in its own chunk. Pushing those chunks into
 * `candidates` (the previous behavior) produced N one-fragment candidates and
 * the SDK only read candidate[0], so every non-streaming call (title
 * generation, prompt enhancement) returned just the first fragment.
 */
export function mergeAntigravityCandidates(target: AntigravityCandidate[], incoming: unknown) {
  if (!Array.isArray(incoming)) return target
  for (let index = 0; index < incoming.length; index++) {
    const next = incoming[index]
    if (!next || typeof next !== "object") continue
    const current = target[index]
    if (!current) {
      target[index] = next
      continue
    }
    const currentParts = Array.isArray(current.content?.parts) ? current.content.parts : []
    const nextParts = Array.isArray(next.content?.parts) ? next.content.parts : []
    target[index] = {
      ...current,
      ...next,
      content: {
        ...current.content,
        ...next.content,
        parts: [...currentParts, ...nextParts],
      },
      finishReason: next.finishReason ?? current.finishReason,
    }
  }
  return target
}

/**
 * Unwraps a Code Assist SSE body into one GenerateContent response. Kept pure
 * so the aggregation can be regression-tested without network access.
 */
export function unwrapAntigravitySse(text: string): Record<string, any> {
  const result: Record<string, any> = { candidates: [] as AntigravityCandidate[] }
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue
    const data = line.slice(6).trim()
    if (!data || data === "[DONE]") continue
    let parsed: any
    try {
      parsed = JSON.parse(data)
    } catch {
      continue
    }
    const chunks = Array.isArray(parsed) ? parsed : [parsed]
    for (const chunk of chunks) {
      const unwrapped = unwrapAntigravityChunk(chunk)
      if (!unwrapped || typeof unwrapped !== "object") continue
      mergeAntigravityCandidates(result.candidates, unwrapped.candidates)
      for (const [key, value] of Object.entries(unwrapped)) {
        if (key !== "candidates") result[key] = value
      }
    }
  }
  return result
}

/**
 * Reacts to a real failure response from Google (429, or a Code Assist
 * error body with `status: "RESOURCE_EXHAUSTED"`) by benching the
 * connection that made the request, reusing rotation.ts's own
 * classification instead of re-deriving cooldown durations here. This
 * covers the gap where quota gets consumed between our proactive check in
 * `checkQuotaAndBenchIfLow` and the actual request landing.
 */
function benchConnectionOnFailure(connectionId: string, status: number, bodyText: string): void {
  let googleStatus: string | undefined
  try {
    googleStatus = JSON.parse(bodyText)?.error?.status
  } catch {}

  // A bare HTTP status maps to isBenchableFailure's 429/rate-limit branch
  // (5 min default). Tagging RESOURCE_EXHAUSTED explicitly routes it to
  // the QuotaExceeded branch instead (15 min default) rather than letting
  // an incidental 429 status code shadow it.
  const errorLike: any =
    googleStatus === "RESOURCE_EXHAUSTED" ? { _tag: "QuotaExceeded" } : { status, message: bodyText }

  const check = IntegrationRotation.isBenchableFailure(errorLike)
  if (check.bench) IntegrationRotation.markUnavailable(toConnection(connectionId), check.durationMs)
}

export interface QuotaBucketInfo {
  modelId: string
  remainingFraction: number
  remainingPercentage: number
  resetTime: string | null
}

export interface UserQuotaDetails {
  email?: string
  tier: "pro" | "free" | "unknown"
  buckets: QuotaBucketInfo[]
  overallPercentage: number
  healthStatus?: "healthy" | "cooldown" | "exhausted" | "disabled"
  cooldownUntil?: number | null
}

export async function fetchUserQuotaDetails(
  credentialID: string,
  profile: "ide" | "cli" = "cli",
): Promise<UserQuotaDetails | null> {
  try {
    const dbFile = CoreDatabase.path()
    const db = await getDb(dbFile)
    const row = db.prepare("SELECT value, disabled FROM credential WHERE id = ?").get(credentialID) as
      | { value: string; disabled?: number | boolean }
      | undefined
    if (!row) return null

    const isDisabled = row.disabled === 1 || row.disabled === true

    const parsed = JSON.parse(row.value)
    const now = Date.now()
    let access = parsed.access as string
    const projectID = parsed.metadata?.projectID || "aicode-consumers"

    // Proactively refresh if needed
    if (parsed.refresh && (!parsed.expires || parsed.expires - now < 300_000)) {
      const refreshed = await refreshAccountToken(credentialID, profile)
      if (refreshed.token) {
        access = refreshed.token
      }
    }

    if (!access) return null

    const client = CLIENT_CONFIGS[profile]
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": client.userAgent,
      Authorization: `Bearer ${access}`,
    }

    // Query loadCodeAssist to get authoritative subscription/tier info (Google AI Pro, Ultra, etc.)
    let subscriptionTierId: string | undefined
    for (const baseUrl of ANTIGRAVITY_BASE_URLS) {
      try {
        const subRes = await fetch(`${baseUrl}/v1internal:loadCodeAssist`, {
          method: "POST",
          headers,
          body: JSON.stringify({ metadata: { ideType: 9, platform: 5, pluginType: 2 } }),
          signal: AbortSignal.timeout(5000),
        })
        if (subRes.ok) {
          const subJson = await subRes.json()
          subscriptionTierId = subJson.paidTier?.id || subJson.currentTier?.id
          break
        }
      } catch {
        continue
      }
    }

    let data: any
    let isAvailableModelsFormat = false

    if (profile === "ide") {
      for (const baseUrl of ANTIGRAVITY_BASE_URLS) {
        try {
          const res = await fetch(`${baseUrl}/v1internal:fetchAvailableModels`, {
            method: "POST",
            headers,
            body: JSON.stringify(projectID ? { project: projectID } : {}),
            signal: AbortSignal.timeout(8000),
          })
          if (res.ok) {
            const json = await res.json()
            if (json && json.models && typeof json.models === "object") {
              data = json
              isAvailableModelsFormat = true
              break
            }
          }
        } catch {
          continue
        }
      }
    }

    if (!data) {
      for (const baseUrl of ANTIGRAVITY_BASE_URLS) {
        try {
          let res = await fetch(`${baseUrl}/v1internal:retrieveUserQuota`, {
            method: "POST",
            headers,
            body: JSON.stringify({ project: projectID }),
            signal: AbortSignal.timeout(8000),
          })
          if (!res.ok) {
            res = await fetch(`${baseUrl}/v1internal:retrieveUserQuota`, {
              method: "POST",
              headers,
              body: "{}",
              signal: AbortSignal.timeout(8000),
            })
          }
          if (!res.ok) continue
          data = await res.json()
          break
        } catch {
          continue
        }
      }
    }

    if (!data) {
      return {
        email: parsed.metadata?.email,
        tier: "free",
        buckets: [],
        overallPercentage: 100,
      }
    }

    const FREE_MODELS_DEFAULT = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash-thinking",
      "gemini-3-flash",
      "gemini-3.1-flash-lite",
    ]

    const buckets: QuotaBucketInfo[] = []
    let totalFraction = 0
    let validCount = 0

    if (isAvailableModelsFormat && data.models) {
      for (const [modelKey, info] of Object.entries(data.models as Record<string, any>)) {
        if (!info?.quotaInfo) continue
        const raw = info.quotaInfo.remainingFraction
        const fraction = typeof raw === "number" ? Math.max(0, Math.min(1, raw)) : 1
        const pct = Math.round(fraction * 100)
        buckets.push({
          modelId: modelKey,
          remainingFraction: fraction,
          remainingPercentage: pct,
          resetTime: info.quotaInfo.resetTime || null,
        })
        if (typeof raw === "number") {
          totalFraction += fraction
          validCount++
        }
      }
    } else if (Array.isArray(data.buckets) && data.buckets.length > 0) {
      for (const bucket of data.buckets) {
        const raw = bucket?.remainingFraction
        const fraction = typeof raw === "number" ? Math.max(0, Math.min(1, raw)) : 1
        const pct = Math.round(fraction * 100)
        buckets.push({
          modelId: bucket?.modelId || bucket?.id || "default",
          remainingFraction: fraction,
          remainingPercentage: pct,
          resetTime: bucket?.resetTime || null,
        })
        if (typeof raw === "number") {
          totalFraction += fraction
          validCount++
        }
      }
    } else {
      // Free tier accounts that do not return explicit buckets array in retrieveUserQuota
      for (const model of FREE_MODELS_DEFAULT) {
        buckets.push({
          modelId: model,
          remainingFraction: 1,
          remainingPercentage: 100,
          resetTime: null,
        })
      }
      validCount = FREE_MODELS_DEFAULT.length
      totalFraction = FREE_MODELS_DEFAULT.length
    }

    const avgFraction = validCount > 0 ? totalFraction / validCount : 1
    // Detect Pro tier:
    // 1. Authoritative check via loadCodeAssist (paidTier id, e.g. "g1-pro-tier", "g1-ultra-tier")
    const subTier = String(subscriptionTierId || "").toLowerCase()
    const isSubPro = subTier.includes("pro") || subTier.includes("ultra") || subTier.includes("premium")

    // 2. Fallback check: metadata or response flags
    const metadataTier = String(parsed.metadata?.tier || "").toLowerCase()
    const isExplicitFree = !isSubPro && (subTier.includes("free") || (!subTier && !metadataTier))

    const isPro =
      isSubPro ||
      (!isExplicitFree &&
        (data.userTier === "PRO" ||
          data.tier === "pro" ||
          Boolean(data.isProUser) ||
          metadataTier.includes("pro")))

    const overallPct = Math.round(avgFraction * 100)
    const cooldownUntil = IntegrationRotation.getCooldownUntilByKey(credentialID)
    let healthStatus: "healthy" | "cooldown" | "exhausted" | "disabled" = "healthy"
    if (isDisabled) {
      healthStatus = "disabled"
    } else if (cooldownUntil && cooldownUntil > Date.now()) {
      healthStatus = "cooldown"
    } else if (overallPct <= 0) {
      healthStatus = "exhausted"
    }

    return {
      email: parsed.metadata?.email,
      tier: isPro ? "pro" : "free",
      buckets,
      overallPercentage: overallPct,
      healthStatus,
      cooldownUntil: cooldownUntil ?? null,
    }
  } catch {
    const cooldownUntil = IntegrationRotation.getCooldownUntilByKey(credentialID)
    return {
      tier: "free",
      buckets: [],
      overallPercentage: 100,
      healthStatus: cooldownUntil && cooldownUntil > Date.now() ? "cooldown" : "healthy",
      cooldownUntil: cooldownUntil ?? null,
    }
  }
}

export function createAntigravityFetch(profile: "ide" | "cli", getOptions?: () => Record<string, any>) {
  const integrationID = profile === "cli" ? "google-antigravity-cli" : "google-antigravity"
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const requestStartedAt = Date.now()
    if (!urlStr.includes("GenerateContent") && !urlStr.includes("generateContent")) {
      return fetch(input, init)
    }

    const opts = getOptions?.() ?? {}
    let token: string | undefined
    let projectID: string | undefined = opts["projectID"]
    let usedConnectionId: string | undefined

    const live = await getLiveToken(integrationID, profile)
    if (live.exhausted) {
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            status: "RESOURCE_EXHAUSTED",
            message: "Todas as contas AGY atingiram o limite de cota; aguarde o reset.",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      )
    }
    if (live.token) {
      token = live.token
      projectID = live.projectID || projectID
      usedConnectionId = live.connectionId
    } else {
      const fallbackToken = opts["accessToken"] ?? opts["apiKey"]
      if (fallbackToken && fallbackToken !== "antigravity-oauth") {
        token = fallbackToken
      }
    }

    const modelMatch = urlStr.match(/\/models\/([^:]+):/)
    const rawModel = modelMatch ? modelMatch[1] : "gemini-pro-agent"
    const candidates = modelCandidates(profile, rawModel)
    let model = candidates[0] ?? rawModel

    const reqBody = typeof init?.body === "string" ? JSON.parse(init.body) : {}

    const budget = rawModel.includes("-high")
      ? 24576
      : rawModel.includes("-medium")
        ? 8192
        : rawModel.includes("-low")
          ? 1024
          : undefined
    if (budget !== undefined && !reqBody.generationConfig?.thinkingConfig) {
      reqBody.generationConfig = { ...reqBody.generationConfig, thinkingConfig: { thinkingBudget: budget } }
    }

    const streaming = urlStr.includes("streamGenerateContent") || urlStr.includes("alt=sse")
    const client = CLIENT_CONFIGS[profile]

    const executeGenerate = async (
      authToken: string | undefined,
      pId: string | undefined,
      candidateModel: string,
    ): Promise<Response | undefined> => {
      const currentHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": client.userAgent,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      }
      const count = Array.isArray(reqBody.contents) ? reqBody.contents.length : 1
      const currentEnvelope = {
        project: pId ?? "aicode-consumers",
        model: candidateModel,
        userAgent: "antigravity",
        requestType: "agent",
        requestId: buildIdeRequestId(pId ?? "aicode-consumers", candidateModel, count),
        request: reqBody,
      }
      const suffix = streaming ? ":streamGenerateContent?alt=sse" : ":generateContent"

      let res: Response | undefined
      for (const baseUrl of orderedBaseUrls(profile)) {
        try {
          const r = await fetch(`${baseUrl}/v1internal${suffix}`, {
            method: "POST",
            headers: currentHeaders,
            body: JSON.stringify(currentEnvelope),
            signal: init?.signal,
          })
          res = r
          if (r.ok) {
            preferredBaseUrl[profile] = baseUrl
            break
          }
        } catch (e) {
          if (!res) res = new Response(String(e), { status: 500 })
        }
      }
      return res
    }

    const executeWithModelFallback = async (authToken: string | undefined, pId: string | undefined) => {
      let response = await executeGenerate(authToken, pId, model)
      for (const next of candidates.slice(1)) {
        if (response?.status !== 404) break
        response = await executeGenerate(authToken, pId, next)
        if (response?.ok) model = next
      }
      if (response?.status === 404) {
        const required = aliasRequired.get(profile) ?? new Set<string>()
        required.add(rawModel)
        aliasRequired.set(profile, required)
      }
      return response
    }

    let upstream = await executeWithModelFallback(token, projectID)

    // Handle 401 / UNAUTHENTICATED / Token expiration with automatic refresh and failover
    if (upstream && !upstream.ok && (upstream.status === 401 || upstream.status === 403)) {
      const bodyText = await upstream
        .clone()
        .text()
        .catch(() => "")
      const isAuthIssue =
        upstream.status === 401 ||
        bodyText.includes("UNAUTHENTICATED") ||
        bodyText.includes("Verify your account") ||
        bodyText.includes("invalid_grant") ||
        bodyText.includes("ACCESS_TOKEN_EXPIRED") ||
        bodyText.includes("Expected OAuth 2 access token") ||
        bodyText.includes("invalid authentication credentials")

      if (isAuthIssue) {
        if (usedConnectionId) {
          // 1. Try immediate token refresh
          const refreshed = await refreshAccountToken(usedConnectionId, profile)
          if (refreshed.token) {
            token = refreshed.token
            projectID = refreshed.projectID || projectID
            upstream = await executeWithModelFallback(token, projectID)
          }
        }

        // 2. If still failing or refresh failed, bench current connection & try failover to next account
        if (!upstream || !upstream.ok) {
          if (usedConnectionId) {
            IntegrationRotation.markUnavailable(toConnection(usedConnectionId), 15 * 60_000)
          }
          const nextLive = await getLiveToken(integrationID, profile)
          if (nextLive.token && nextLive.connectionId !== usedConnectionId) {
            token = nextLive.token
            projectID = nextLive.projectID || projectID
            usedConnectionId = nextLive.connectionId
            upstream = await executeWithModelFallback(token, projectID)
          }
        }
      }
    }

    if (!upstream || !upstream.ok) {
      if (usedConnectionId && upstream) {
        const bodyText = await upstream
          .clone()
          .text()
          .catch(() => "")
        benchConnectionOnFailure(usedConnectionId, upstream.status, bodyText)
      }
      return upstream ?? new Response("Antigravity API Unavailable", { status: 502 })
    }

    if (!upstream.body) {
      return upstream
    }

    // Non-streaming callers (title generation, prompt enhancement, doGenerate)
    // get the plain generateContent response instead of us buffering an entire
    // SSE exchange and merging it back into JSON.
    if (!streaming) {
      const json = await upstream.json()
      return new Response(JSON.stringify(unwrapAntigravityChunk(json)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const timing: StreamTiming = {
      profile,
      model,
      startedAt: requestStartedAt,
      lastChunkAt: requestStartedAt,
      chunks: 0,
      bytes: 0,
      maxGapMs: 0,
    }

    let outcome = "closed"
    const reader = upstream.body
      .pipeThrough(createIdleGuard(STREAM_IDLE_TIMEOUT_MS, (error) => logStreamTiming(timing, error.message)))
      .pipeThrough(createSseTransform(timing))
      .getReader()

    // One read per pull keeps the queue bounded, so a slow consumer throttles
    // the upstream instead of buffering the whole response in memory.
    const transformed = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            logStreamTiming(timing, outcome)
            return
          }
          controller.enqueue(value)
        } catch (error) {
          outcome = String(error)
          controller.error(error)
          logStreamTiming(timing, outcome)
        }
      },
      cancel(reason) {
        outcome = "cancelled"
        logStreamTiming(timing, outcome)
        return reader.cancel(reason)
      },
    })

    return new Response(transformed, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  }
}

