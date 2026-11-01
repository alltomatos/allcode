// Central access model for tenant collaborators. Every consumer (portal UI,
// API handlers, desktop client) resolves permissions through these helpers so
// the rules live in exactly one place.

export const RESOURCES = [
  "agentui",
  "routines",
  "servers",
  "providers",
  "models",
  "combos",
  "skills",
  "memories",
  "mcp",
] as const

export type Resource = (typeof RESOURCES)[number]

/** Sparse overrides: an omitted key means "inherit". */
export type AccessOverrides = Partial<Record<Resource, boolean>>
export type AccessMap = Record<Resource, boolean>

export const FULL_ACCESS: AccessMap = {
  agentui: true,
  routines: true,
  servers: true,
  providers: true,
  models: true,
  combos: true,
  skills: true,
  memories: true,
  mcp: true,
}

export const NO_ACCESS: AccessMap = {
  agentui: false,
  routines: false,
  servers: false,
  providers: false,
  models: false,
  combos: false,
  skills: false,
  memories: false,
  mcp: false,
}

/**
 * Precedence (documented contract):
 *   1. Individual overrides on the collaborator win over everything.
 *   2. Groups are the base. When a collaborator belongs to several groups the
 *      union is used (most permissive wins) so adding a group never removes an
 *      access granted by another one.
 *   3. Anything still unspecified falls back to the tenant default, which is
 *      full access for backwards compatibility with existing tenants.
 */
export function resolveAccess(input: {
  individual?: AccessOverrides | null
  groups?: (AccessOverrides | null | undefined)[]
  tenant?: AccessOverrides | null
}): AccessMap {
  const result: AccessMap = { ...FULL_ACCESS, ...pick(input.tenant) }

  const groupValues = new Map<Resource, boolean[]>()
  for (const group of input.groups ?? []) {
    for (const resource of RESOURCES) {
      const value = pick(group)[resource]
      if (value === undefined) continue
      groupValues.set(resource, [...(groupValues.get(resource) ?? []), value])
    }
  }
  // Union: if any group grants a resource it stays granted; a resource only
  // becomes denied when every group that mentions it denies it.
  for (const [resource, values] of groupValues) {
    result[resource] = values.some((value) => value === true)
  }

  for (const [key, value] of Object.entries(pick(input.individual))) {
    result[key as Resource] = value!
  }
  return result
}

/** Settings sections exposed to the desktop, derived from the resource map. */
export const SETTINGS_SECTIONS = [
  "providers",
  "models",
  "combos",
  "skills",
  "memories",
  "mcp",
  "servers",
  "routines",
  "agents",
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

export function settingsAccess(access: AccessMap, enabled = true): Record<SettingsSection, boolean> {
  return {
    providers: enabled && access.providers,
    models: enabled && access.models,
    combos: enabled && access.combos,
    skills: enabled && access.skills,
    memories: enabled && access.memories,
    mcp: enabled && access.mcp,
    servers: enabled && access.servers,
    routines: enabled && access.routines,
    agents: enabled && access.agentui,
  }
}

export type ModelDefault = { provider?: string; model?: string }

/**
 * Settings visibility follows the same union rule as resources: an explicit
 * per-user flag wins, otherwise any group that allows settings keeps it open.
 */
export function resolveCanOpenSettings(
  flag: boolean | null | undefined,
  groups: readonly { canOpenSettings: boolean }[],
): boolean {
  if (typeof flag === "boolean") return flag
  if (groups.length === 0) return true
  return groups.some((group) => group.canOpenSettings)
}

/**
 * Model precedence: the manager's per-user default wins over the tenant
 * default. The collaborator's own choice is handled by the desktop client and
 * always wins over both (it is stored locally per prompt).
 */
export function resolveDefaultModel(user?: ModelDefault | null, tenant?: ModelDefault | null): ModelDefault | undefined {
  const userProvider = user?.provider?.trim()
  if (userProvider) return { provider: userProvider, model: user?.model?.trim() || undefined }

  const tenantProvider = tenant?.provider?.trim()
  const tenantModel = tenant?.model?.trim()
  if (!tenantProvider && !tenantModel) return undefined
  return { provider: tenantProvider || undefined, model: tenantModel || undefined }
}

export type ProviderEffect = "allow" | "deny"

export type ProvisionedProvider = {
  id: string
  name: string
  kind: "builtin" | "custom" | "proxy"
  protocol?: "openai" | "anthropic"
  npm?: string
  baseURL?: string
  apiKey?: string
  models: Array<{ id: string; name: string; enabled?: boolean }>
  headers: Record<string, string>
  env: string[]
}

export type ProviderCatalogEntry = {
  id?: string
  providerID: string
  displayName?: string
  kind?: "builtin" | "custom" | "proxy"
  protocol?: "openai" | "anthropic"
  npm?: string
  baseURL?: string
  apiKey?: string
  models?: Array<{ id: string; name: string; enabled?: boolean }>
  headers?: Array<{ key: string; value: string }>
  env?: string[]
  enabled: boolean
}
export type ProviderGrantInput = { providerID: string; effect: ProviderEffect }

/**
 * Effective provider allowlist for a collaborator.
 *
 * - `restricted` means the tenant catalog is the universe: anything not listed is
 *   hidden. When false the tenant imposes no allowlist and `allowed` stays empty,
 *   so the desktop keeps every provider it already knows about.
 * - Group grants are a union where a deny wins inside the same layer; individual
 *   grants are applied afterwards so an explicit per-user choice always wins.
 */
export type ProviderPolicy = {
  restricted: boolean
  allowLocal: boolean
  allowed: string[]
  denied: string[]
  version: string
  provisioned: ProvisionedProvider[]
}

export function resolveProviderPolicy(input: {
  catalog: readonly ProviderCatalogEntry[]
  restricted: boolean
  allowLocal: boolean
  groupGrants?: readonly ProviderGrantInput[]
  individualGrants?: readonly ProviderGrantInput[]
}): ProviderPolicy {
  const enabled = new Set(
    input.catalog.filter((entry) => entry.enabled).map((entry) => entry.providerID),
  )
  const allowed = new Set<string>(input.restricted ? [...enabled] : [])
  const denied = new Set<string>()
  const applies = (providerID: string) => (input.restricted ? enabled.has(providerID) : true)

  for (const grant of input.groupGrants ?? []) {
    if (!applies(grant.providerID)) continue
    if (grant.effect === "allow") {
      allowed.add(grant.providerID)
      denied.delete(grant.providerID)
    } else {
      allowed.delete(grant.providerID)
      denied.add(grant.providerID)
    }
  }

  for (const grant of input.individualGrants ?? []) {
    if (!applies(grant.providerID)) continue
    if (grant.effect === "allow") {
      allowed.add(grant.providerID)
      denied.delete(grant.providerID)
    } else {
      allowed.delete(grant.providerID)
      denied.add(grant.providerID)
    }
  }

  const provisioned: ProvisionedProvider[] = []
  for (const entry of input.catalog) {
    if (!entry.enabled) continue
    const allowedForUser = input.restricted ? allowed.has(entry.providerID) : !denied.has(entry.providerID)
    if (!allowedForUser) continue
    if (
      entry.kind === "proxy" ||
      entry.kind === "custom" ||
      entry.baseURL ||
      (entry.models && entry.models.length > 0)
    ) {
      const activeModels = (entry.models ?? []).filter((m) => m.enabled !== false)
      provisioned.push({
        id: entry.providerID,
        name: entry.displayName || entry.providerID,
        kind: entry.kind || "custom",
        protocol: entry.protocol || "openai",
        npm: entry.npm || (entry.protocol === "anthropic" ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible"),
        baseURL: entry.baseURL,
        apiKey: entry.apiKey,
        models: activeModels,
        headers: Object.fromEntries((entry.headers ?? []).map((h) => [h.key, h.value])),
        env: entry.env ?? [],
      })
    }
  }

  const policy = {
    restricted: input.restricted,
    allowLocal: input.allowLocal,
    allowed: [...allowed].sort(),
    denied: [...denied].sort(),
    provisioned,
  }
  return { ...policy, version: stableHash(JSON.stringify(policy)) }
}

export function isProviderAllowed(policy: ProviderPolicy, providerID: string) {
  if (policy.denied.includes(providerID)) return false
  if (!policy.restricted) return true
  return policy.allowed.includes(providerID)
}

/** Short deterministic hash so the desktop can detect policy changes cheaply. */function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function parseOverrides(value: unknown): AccessOverrides {  if (typeof value !== "string" || !value.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {}
    const result: AccessOverrides = {}
    for (const resource of RESOURCES) {
      const entry = (parsed as Record<string, unknown>)[resource]
      if (typeof entry === "boolean") result[resource] = entry
    }
    return result
  } catch {
    return {}
  }
}

export function stringifyOverrides(overrides: AccessOverrides | undefined): string {
  const clean = pick(overrides)
  return JSON.stringify(clean)
}

function pick(overrides: AccessOverrides | null | undefined): AccessOverrides {
  const result: AccessOverrides = {}
  if (!overrides) return result
  for (const resource of RESOURCES) {
    const value = overrides[resource]
    if (typeof value === "boolean") result[resource] = value
  }
  return result
}
