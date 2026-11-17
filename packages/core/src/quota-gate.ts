import { Effect } from "effect"

export type QuotaDecision =
  | { allowed: true }
  | {
      allowed: false
      scope: "user" | "company"
      message: string
      limit: number
      used: number
      remaining: number
    }

type Cached = { at: number; decision: QuotaDecision }

const CACHE_TTL_MS = 10_000
const cache = new Map<string, Cached>()

/**
 * Asks the corporate portal whether the user/company still has token quota.
 * Returns `null` when no portal context was provided (standalone/self-hosted).
 * Network failures fail open so a portal outage never locks the local agent.
 */
export function checkTenantQuota(input: {
  panelUrl?: string | null
  userID?: string | null
  orgID?: string | null
}): Effect.Effect<QuotaDecision | null> {
  const panelUrl = input.panelUrl?.trim().replace(/\/+$/, "")
  const userID = input.userID?.trim()
  const orgID = input.orgID?.trim()
  if (!panelUrl || !userID || !orgID) return Effect.succeed(null)

  const key = `${orgID}:${userID}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Effect.succeed(cached.decision)

  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${panelUrl}/api/v1/quota/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: userID, orgId: orgID }),
        signal: AbortSignal.timeout(5_000),
      })

      if (response.status === 429) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { scope?: string; message?: string; limit?: number; used?: number; remaining?: number } }
          | null
        const error = body?.error
        const decision: QuotaDecision = {
          allowed: false,
          scope: error?.scope === "user" ? "user" : "company",
          message: error?.message ?? "A cota de tokens foi esgotada.",
          limit: Number(error?.limit ?? 0),
          used: Number(error?.used ?? 0),
          remaining: Number(error?.remaining ?? 0),
        }
        cache.set(key, { at: Date.now(), decision })
        return decision
      }

      if (!response.ok) return null
      const decision: QuotaDecision = { allowed: true }
      cache.set(key, { at: Date.now(), decision })
      return decision
    },
    catch: () => null,
  }).pipe(Effect.catch(() => Effect.succeed(null)))
}
