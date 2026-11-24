export type QuotaScope = "user" | "company"

export type QuotaBucket = {
  limit: number | null
  used: number
  remaining: number | null
}

export type QuotaState = {
  cycleStart: string
  cycleEnd: string
  company: QuotaBucket
  user: QuotaBucket
  blocked: boolean
  scope?: QuotaScope
}

export type QuotaExceeded = {
  code: "QUOTA_EXCEEDED"
  scope: QuotaScope
  message: string
  limit: number
  used: number
  remaining: number
}

const SUFFIX: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 }

/**
 * Parses token amounts such as `900k`, `1M`, `1,5M`, `50M` and `50.000.000`.
 * Returns `null` for empty, zero, negative or malformed input.
 */
export function parseTokenAmount(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isSafeInteger(input) && input > 0 ? input : null
  }
  if (typeof input !== "string") return null

  const raw = input.trim().replace(/[\s_]/g, "")
  if (!raw) return null

  const match = /^([0-9][0-9.,]*)([kmb])?$/i.exec(raw)
  if (!match) return null

  const suffix = match[2]?.toLowerCase()
  const numberPart = match[1]
  const separators = numberPart.match(/[.,]/g)?.length ?? 0

  let normalized = numberPart
  if (separators > 1) {
    normalized = numberPart.replace(/[.,]/g, "")
  } else if (separators === 1) {
    const [whole, fraction] = numberPart.split(/[.,]/)
    normalized = fraction.length === 3 && !suffix ? `${whole}${fraction}` : `${whole}.${fraction}`
  }

  const base = Number(normalized)
  if (!Number.isFinite(base) || base <= 0) return null

  const value = Math.floor(base * (suffix ? SUFFIX[suffix] : 1))
  if (!Number.isSafeInteger(value) || value <= 0) return null
  return value
}

export function formatTokenAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "∞"
  if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`
  if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`
  if (value >= 1_000) return `${trim(value / 1_000)}k`
  return String(value)
}

function trim(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "")
}

export function normalizeCycleDay(input: unknown): number {
  const value = Number(input)
  if (!Number.isFinite(value)) return 1
  return Math.min(31, Math.max(1, Math.trunc(value)))
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Returns the current billing cycle window for a tenant that closes on `cycleDay`. */
export function cycleWindow(cycleDay: number, now = new Date()) {
  const day = normalizeCycleDay(cycleDay)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const currentDay = now.getUTCDate()

  const startYear = currentDay >= day ? year : month === 0 ? year - 1 : year
  const startMonth = currentDay >= day ? month : month === 0 ? 11 : month - 1
  const start = new Date(Date.UTC(startYear, startMonth, Math.min(day, daysInMonth(startYear, startMonth))))

  const nextYear = startMonth === 11 ? startYear + 1 : startYear
  const nextMonth = startMonth === 11 ? 0 : startMonth + 1
  const end = new Date(Date.UTC(nextYear, nextMonth, Math.min(day, daysInMonth(nextYear, nextMonth))))

  return { start: start.toISOString(), end: end.toISOString() }
}

function bucket(limit: number | null, used: number): QuotaBucket {
  const normalized = Math.max(0, Math.trunc(used))
  if (limit === null) return { limit: null, used: normalized, remaining: null }
  return { limit, used: normalized, remaining: Math.max(0, limit - normalized) }
}

export function resolveQuotaState(input: {
  companyLimit: number | null
  userLimit: number | null
  companyUsed: number
  userUsed: number
  cycleStart: string
  cycleEnd: string
}): QuotaState {
  const company = bucket(input.companyLimit, input.companyUsed)
  const user = bucket(input.userLimit, input.userUsed)

  const scope: QuotaScope | undefined =
    company.limit !== null && company.used >= company.limit
      ? "company"
      : user.limit !== null && user.used >= user.limit
        ? "user"
        : undefined

  return {
    cycleStart: input.cycleStart,
    cycleEnd: input.cycleEnd,
    company,
    user,
    blocked: scope !== undefined,
    ...(scope ? { scope } : {}),
  }
}

export type UserQuotaSource = "individual" | "company" | "pool"

/**
 * Precedence: individual user quota > company-wide per-user quota > company pool.
 * The effective quota never exceeds the company pool when one is configured.
 */
export function effectiveUserLimit(input: {
  individual?: number | null
  global?: number | null
  companyPool?: number | null
}): { limit: number | null; source: UserQuotaSource } {
  const raw = input.individual ?? input.global ?? null
  const source: UserQuotaSource =
    input.individual !== null && input.individual !== undefined
      ? "individual"
      : input.global !== null && input.global !== undefined
        ? "company"
        : "pool"
  const limit =
    raw !== null && input.companyPool !== null && input.companyPool !== undefined
      ? Math.min(raw, input.companyPool)
      : raw
  return { limit, source }
}

export function quotaExceeded(state: QuotaState): QuotaExceeded | null {
  if (!state.blocked || !state.scope) return null
  const bucket = state.scope === "company" ? state.company : state.user
  const limit = bucket.limit ?? 0
  return {
    code: "QUOTA_EXCEEDED",
    scope: state.scope,
    message:
      state.scope === "company"
        ? "A cota de tokens da empresa foi esgotada."
        : "A cota individual de tokens deste usuário foi esgotada.",
    limit,
    used: bucket.used,
    remaining: bucket.remaining ?? 0,
  }
}
