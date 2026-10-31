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

export function parseOverrides(value: unknown): AccessOverrides {
  if (typeof value !== "string" || !value.trim()) return {}
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
