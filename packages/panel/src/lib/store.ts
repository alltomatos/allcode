import { hashPassword } from "./crypto"
import { bindings, env } from "./env"

export type Role = "owner" | "admin" | "member"
export type Status = "invited" | "active" | "suspended" | "deleted"

export type PanelUser = {
  id: string
  orgID: string
  name: string
  email: string
  role: Role
  status: Status
  passwordHash: string
  mustChangePassword: boolean
  isPlatformAdmin: boolean
  canUseAgentUI: boolean
  canUseRoutines: boolean
  canChangePassword: boolean
  /** undefined = inherit from the access groups. */
  canOpenSettings?: boolean
  defaultProvider?: string
  defaultModel?: string
  accessOverrides: string
  appVersion?: string
  appVersionAt?: string
  createdAt: string
  lastLoginAt?: string
}

export type AccessGroup = {
  id: string
  orgID: string
  name: string
  description?: string
  access: string
  canOpenSettings: boolean
  createdAt: string
}

export type ProviderKind = "builtin" | "custom" | "proxy"
export type ProviderEffect = "allow" | "deny"
export type ProviderProtocol = "openai" | "anthropic"

export type ProviderModel = { id: string; name: string; enabled?: boolean }
export type ProviderHeader = { key: string; value: string }

export type ProviderDefinition = {
  id: string
  orgID: string
  providerID: string
  displayName: string
  kind: ProviderKind
  protocol: ProviderProtocol
  npm?: string
  baseURL?: string
  apiKey?: string
  models: ProviderModel[]
  headers: ProviderHeader[]
  env: string[]
  enabled: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export type ProviderGrant = {
  scope: "group" | "user"
  scopeID: string
  providerID: string
  effect: ProviderEffect
}

export type UserProviderCredential = {
  userID: string
  providerID: string
  apiKey: string
  createdAt: string
  updatedAt: string
}

export type SessionAudit = {
  id: string
  sessionID: string
  userID: string
  orgID: string
  title: string
  summary: string
  workspace: string
  startedAt: string
  endedAt?: string
  tokensTotal: number
  tokensInput: number
  tokensOutput: number
  tokensReasoning: number
  costUsd: number
  durationMs: number
  messagesCount: number
  modelUsage: ModelUsageEntry[]
  createdAt: string
}

export type ModelUsageEntry = {
  providerID: string
  modelID: string
  tokens: number
  costUsd: number
  calls: number
}

export type ModelUsageSummary = ModelUsageEntry & {
  sessions: number
}

export type UserKPIs = {
  totalSessions: number
  totalTokens: number
  totalCostUsd: number
  totalDurationMs: number
}

export type SessionListOptions = {
  userID?: string
  search?: string
  limit?: number
  offset?: number
}

export type Organization = {
  id: string
  name: string
  slug: string
  status: "active" | "suspended"
  maxUsers: number
  contactEmail?: string
  logoUrl?: string
  welcomeMessage?: string
  brandColor?: string
  ssoMode: "optional" | "required"
  offlineGraceHours: number
  sessionMaxAgeHours: number
  defaultProvider?: string
  defaultModel?: string
  /** true = only providers explicitly granted are visible. */
  providerRestricted: boolean
  /** When restricted, local-only providers keep working if this is true. */
  allowLocalProviders: boolean
  createdAt: string
}

export type AuditEvent = {
  id: string
  orgID: string
  actorID?: string
  actorEmail: string
  action: string
  targetType?: string
  targetID?: string
  result: "allow" | "deny"
  at: string
}

export type UserPatch = Partial<
  Pick<
    PanelUser,
    | "name"
    | "email"
    | "role"
    | "status"
    | "passwordHash"
    | "mustChangePassword"
    | "lastLoginAt"
    | "appVersion"
    | "appVersionAt"
    | "canUseAgentUI"
    | "canUseRoutines"
    | "canChangePassword"
    | "canOpenSettings"
    | "defaultProvider"
    | "defaultModel"
    | "accessOverrides"
  >
>

export type OrgPatch = Partial<
  Pick<
    Organization,
    | "name"
    | "slug"
    | "status"
    | "maxUsers"
    | "contactEmail"
    | "logoUrl"
    | "welcomeMessage"
    | "brandColor"
    | "ssoMode"
    | "offlineGraceHours"
    | "sessionMaxAgeHours"
    | "defaultProvider"
    | "defaultModel"
    | "providerRestricted"
    | "allowLocalProviders"
  >
>

export type TenantStats = {
  totalTenants: number
  activeTenants: number
  suspendedTenants: number
  totalUsersAcrossTenants: number
}

export type Store = {
  ensureSeed(): Promise<void>
  org: {
    get(id?: string): Promise<Organization>
    list(): Promise<Organization[]>
    findBySlug(slug: string): Promise<Organization | undefined>
    create(input: {
      name: string
      slug: string
      maxUsers?: number
      contactEmail?: string
    }): Promise<Organization>
    update(id: string, patch: OrgPatch): Promise<Organization>
    stats(): Promise<TenantStats>
  }
  users: {
    list(orgID?: string): Promise<PanelUser[]>
    findByID(id: string): Promise<PanelUser | undefined>
    findByEmail(email: string): Promise<PanelUser | undefined>
    create(input: {
      orgID?: string
      name: string
      email: string
      role: Role
      passwordHash: string
      mustChangePassword: boolean
      isPlatformAdmin?: boolean
      canUseAgentUI?: boolean
      canUseRoutines?: boolean
      canChangePassword?: boolean
      canOpenSettings?: boolean
      defaultProvider?: string
      defaultModel?: string
      accessOverrides?: Record<string, boolean>
    }): Promise<PanelUser>
    update(id: string, patch: UserPatch): Promise<PanelUser | undefined>
    count(orgID?: string): Promise<{ total: number; active: number; invited: number; suspended: number }>
  }
  groups: {
    list(orgID?: string): Promise<AccessGroup[]>
    findByID(id: string): Promise<AccessGroup | undefined>
    create(input: {
      orgID?: string
      name: string
      description?: string
      access?: Record<string, boolean>
      canOpenSettings?: boolean
    }): Promise<AccessGroup>
    update(
      id: string,
      patch: {
        name?: string
        description?: string
        access?: Record<string, boolean>
        canOpenSettings?: boolean
      },
    ): Promise<AccessGroup | undefined>
    remove(id: string): Promise<void>
    members(groupID: string): Promise<string[]>
    groupsForUser(userID: string): Promise<AccessGroup[]>
    setMembers(groupID: string, userIDs: string[]): Promise<void>
    setUserGroups(userID: string, groupIDs: string[]): Promise<void>
  }
  providers: {
    list(orgID?: string): Promise<ProviderDefinition[]>
    findByID(id: string): Promise<ProviderDefinition | undefined>
    findByProviderID(orgID: string, providerID: string): Promise<ProviderDefinition | undefined>
    create(input: {
      orgID: string
      providerID: string
      displayName: string
      kind?: ProviderKind
      protocol?: ProviderProtocol
      npm?: string
      baseURL?: string
      apiKey?: string
      models?: ProviderModel[]
      headers?: ProviderHeader[]
      env?: string[]
      enabled?: boolean
      createdBy?: string
    }): Promise<ProviderDefinition>
    update(
      id: string,
      patch: {
        displayName?: string
        protocol?: ProviderProtocol
        npm?: string
        baseURL?: string
        apiKey?: string
        models?: ProviderModel[]
        headers?: ProviderHeader[]
        env?: string[]
        enabled?: boolean
      },
    ): Promise<ProviderDefinition | undefined>
    remove(id: string): Promise<void>
    grants(scope: "group" | "user", scopeID: string): Promise<ProviderGrant[]>
    grantsForScopes(scope: "group" | "user", scopeIDs: string[]): Promise<ProviderGrant[]>
    setGrants(scope: "group" | "user", scopeID: string, grants: ProviderGrant[]): Promise<void>
    removeGrantsForProvider(orgID: string, providerID: string): Promise<void>
  }
  sessions: {
    create(input: Omit<SessionAudit, "id" | "createdAt">): Promise<SessionAudit>
    listByUser(userID: string, limit?: number): Promise<SessionAudit[]>
    listByOrg(orgID: string, options?: SessionListOptions): Promise<SessionAudit[]>
    findBySessionID(sessionID: string): Promise<SessionAudit | undefined>
    getUserKPIs(userID: string): Promise<UserKPIs>
    getOrgKPIs(orgID: string): Promise<UserKPIs>
    getUserModelUsage(userID: string, options?: { days?: number }): Promise<ModelUsageSummary[]>
  }
  credentials: {
    listByUser(userID: string): Promise<UserProviderCredential[]>
    findByUserAndProvider(userID: string, providerID: string): Promise<UserProviderCredential | undefined>
    set(userID: string, providerID: string, apiKey: string): Promise<void>
    remove(userID: string, providerID: string): Promise<void>
  }
  audit: {
    log(event: Omit<AuditEvent, "id" | "orgID" | "at"> & { orgID?: string }): Promise<AuditEvent>
    list(orgID?: string, limit?: number): Promise<AuditEvent[]>
    forTarget(targetID: string, limit?: number): Promise<AuditEvent[]>
  }
}

export const DEFAULT_ORG_ID = "org_default"

function defaultOrg(): Organization {
  return {
    id: DEFAULT_ORG_ID,
    name: "AllCode Demo",
    slug: "allcode-demo",
    status: "active",
    maxUsers: 50,
    contactEmail: "admin@allcode.dev",
    logoUrl: undefined,
    welcomeMessage: "Bem-vindo ao AllCode Workspace",
    brandColor: "#10b981",
    ssoMode: "optional",
    offlineGraceHours: 72,
    sessionMaxAgeHours: 12,
    providerRestricted: false,
    allowLocalProviders: true,
    createdAt: new Date().toISOString(),
  }
}

function seedEmail() {
  return env("PANEL_ADMIN_EMAIL", "admin@allcode.dev").toLowerCase()
}

function seedPassword() {
  return env("PANEL_ADMIN_PASSWORD", "allcode123")
}

function memoryStore(): Store {
  const users = new Map<string, PanelUser>()
  const events: AuditEvent[] = []
  const orgs = new Map<string, Organization>()
  const groups = new Map<string, AccessGroup>()
  const members = new Map<string, Set<string>>()
  const providers = new Map<string, ProviderDefinition>()
  const providerGrants = new Map<string, ProviderGrant[]>()
  const sessionRecords: SessionAudit[] = []
  const credentials = new Map<string, UserProviderCredential>()
  const initialOrg = defaultOrg()
  orgs.set(initialOrg.id, initialOrg)
  let seeding: Promise<void> | undefined

  function find(id: string) {
    return [...users.values()].find((user) => user.id === id)
  }

  return {
    ensureSeed() {
      seeding ??= (async () => {
        const email = seedEmail()
        if (users.has(email)) return
        users.set(email, {
          id: crypto.randomUUID(),
          orgID: initialOrg.id,
          name: "Administrador",
          email,
          role: "owner",
          status: "active",
          passwordHash: await hashPassword(seedPassword()),
          mustChangePassword: false,
          isPlatformAdmin: true,
          canUseAgentUI: true,
          canUseRoutines: true,
          canChangePassword: true,
          canOpenSettings: true,
          accessOverrides: "{}",
          createdAt: new Date().toISOString(),
        })
      })()
      return seeding
    },
    org: {
      async get(id = DEFAULT_ORG_ID) {
        return orgs.get(id) ?? { ...initialOrg, id }
      },
      async list() {
        return [...orgs.values()].sort((a, b) => a.name.localeCompare(b.name))
      },
      async findBySlug(slug) {
        return [...orgs.values()].find((o) => o.slug === slug.trim().toLowerCase())
      },
      async create(input) {
        const newOrg: Organization = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          status: "active",
          maxUsers: input.maxUsers ?? 10,
          contactEmail: input.contactEmail,
          ssoMode: "optional",
          offlineGraceHours: 72,
          sessionMaxAgeHours: 12,
          providerRestricted: false,
          allowLocalProviders: true,
          createdAt: new Date().toISOString(),
        }
        orgs.set(newOrg.id, newOrg)
        return newOrg
      },
      async update(id, patch) {
        const target = orgs.get(id) ?? { ...initialOrg, id }
        Object.assign(target, patch)
        orgs.set(id, target)
        return { ...target }
      },
      async stats() {
        const list = [...orgs.values()]
        const totalUsers = [...users.values()].filter((u) => u.status !== "deleted").length
        return {
          totalTenants: list.length,
          activeTenants: list.filter((o) => o.status === "active").length,
          suspendedTenants: list.filter((o) => o.status === "suspended").length,
          totalUsersAcrossTenants: totalUsers,
        }
      },
    },
    users: {
      async list(orgID) {
        return [...users.values()]
          .filter((user) => user.status !== "deleted" && (!orgID || user.orgID === orgID))
          .sort((left, right) => left.name.localeCompare(right.name))
      },
      async findByID(id) {
        return find(id)
      },
      async findByEmail(email) {
        return users.get(email.trim().toLowerCase())
      },
      async create(input) {
        const user: PanelUser = {
          id: crypto.randomUUID(),
          orgID: input.orgID ?? DEFAULT_ORG_ID,
          name: input.name,
          email: input.email.toLowerCase(),
          role: input.role,
          status: "invited",
          passwordHash: input.passwordHash,
          mustChangePassword: input.mustChangePassword,
          isPlatformAdmin: input.isPlatformAdmin ?? false,
          canUseAgentUI: input.canUseAgentUI ?? true,
          canUseRoutines: input.canUseRoutines ?? true,
          canChangePassword: input.canChangePassword ?? true,
          canOpenSettings: input.canOpenSettings ?? true,
          defaultProvider: input.defaultProvider,
          defaultModel: input.defaultModel,
          accessOverrides: JSON.stringify(input.accessOverrides ?? {}),
          createdAt: new Date().toISOString(),
        }
        users.set(user.email, user)
        return user
      },
      async update(id, patch) {
        const user = find(id)
        if (!user) return
        const previousEmail = user.email
        Object.assign(user, patch)
        if (patch.email && patch.email !== previousEmail) {
          users.delete(previousEmail)
          users.set(patch.email.toLowerCase(), user)
        }
        return user
      },
      async count(orgID) {
        const list = [...users.values()].filter((user) => user.status !== "deleted" && (!orgID || user.orgID === orgID))
        return {
          total: list.length,
          active: list.filter((user) => user.status === "active").length,
          invited: list.filter((user) => user.status === "invited").length,
          suspended: list.filter((user) => user.status === "suspended").length,
        }
      },
    },
    groups: {
      async list(orgID) {
        return [...groups.values()]
          .filter((group) => !orgID || group.orgID === orgID)
          .sort((left, right) => left.name.localeCompare(right.name))
      },
      async findByID(id) {
        return groups.get(id)
      },
      async create(input) {
        const group: AccessGroup = {
          id: crypto.randomUUID(),
          orgID: input.orgID ?? DEFAULT_ORG_ID,
          name: input.name,
          description: input.description,
          access: JSON.stringify(input.access ?? {}),
          canOpenSettings: input.canOpenSettings ?? true,
          createdAt: new Date().toISOString(),
        }
        groups.set(group.id, group)
        members.set(group.id, new Set())
        return group
      },
      async update(id, patch) {
        const group = groups.get(id)
        if (!group) return
        Object.assign(group, {
          ...patch,
          access: patch.access ? JSON.stringify(patch.access) : group.access,
        })
        return group
      },
      async remove(id) {
        groups.delete(id)
        members.delete(id)
      },
      async members(groupID) {
        return [...(members.get(groupID) ?? [])]
      },
      async groupsForUser(userID) {
        return [...members.entries()]
          .filter(([, set]) => set.has(userID))
          .flatMap(([groupId]) => {
            const group = groups.get(groupId)
            return group ? [group] : []
          })
      },
      async setMembers(groupID, userIDs) {
        members.set(groupID, new Set(userIDs))
      },
      async setUserGroups(userID, groupIDs) {
        for (const [groupId, set] of members) {
          if (groupIDs.includes(groupId)) set.add(userID)
          else set.delete(userID)
        }
      },
    },
    providers: {
      async list(orgID) {
        return [...providers.values()]
          .filter((provider) => !orgID || provider.orgID === orgID)
          .sort((left, right) => left.displayName.localeCompare(right.displayName))
      },
      async findByID(id) {
        return providers.get(id)
      },
      async findByProviderID(orgID, providerID) {
        return [...providers.values()].find(
          (provider) => provider.orgID === orgID && provider.providerID === providerID,
        )
      },
      async create(input) {
        const now = new Date().toISOString()
        const provider: ProviderDefinition = {
          id: crypto.randomUUID(),
          orgID: input.orgID,
          providerID: input.providerID,
          displayName: input.displayName,
          kind: input.kind ?? "builtin",
          protocol: input.protocol ?? "openai",
          npm: input.npm,
          baseURL: input.baseURL,
          apiKey: input.apiKey,
          models: input.models ?? [],
          headers: input.headers ?? [],
          env: input.env ?? [],
          enabled: input.enabled ?? true,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        }
        providers.set(provider.id, provider)
        return provider
      },
      async update(id, patch) {
        const provider = providers.get(id)
        if (!provider) return
        Object.assign(provider, patch, { updatedAt: new Date().toISOString() })
        return provider
      },
      async remove(id) {
        const provider = providers.get(id)
        providers.delete(id)
        if (!provider) return
        const orgGroups = new Set(
          [...groups.values()].filter((group) => group.orgID === provider.orgID).map((group) => group.id),
        )
        const orgUsers = new Set(
          [...users.values()].filter((user) => user.orgID === provider.orgID).map((user) => user.id),
        )
        for (const [key, grants] of providerGrants) {
          const [scope, scopeID] = key.split(":")
          if (scope === "group" && !orgGroups.has(scopeID!)) continue
          if (scope === "user" && !orgUsers.has(scopeID!)) continue
          providerGrants.set(
            key,
            grants.filter((grant) => grant.providerID !== provider.providerID),
          )
        }
      },
      async grants(scope, scopeID) {
        return providerGrants.get(`${scope}:${scopeID}`) ?? []
      },
      async grantsForScopes(scope, scopeIDs) {
        return scopeIDs.flatMap((scopeID) => providerGrants.get(`${scope}:${scopeID}`) ?? [])
      },
      async setGrants(scope, scopeID, grants) {
        providerGrants.set(
          `${scope}:${scopeID}`,
          grants.map((grant) => ({ ...grant, scope, scopeID })),
        )
      },
      async removeGrantsForProvider(orgID, providerID) {
        const orgGroups = new Set(
          [...groups.values()].filter((group) => group.orgID === orgID).map((group) => group.id),
        )
        const orgUsers = new Set(
          [...users.values()].filter((user) => user.orgID === orgID).map((user) => user.id),
        )
        for (const [key, grants] of providerGrants) {
          const [scope, scopeID] = key.split(":")
          if (scope === "group" && !orgGroups.has(scopeID!)) continue
          if (scope === "user" && !orgUsers.has(scopeID!)) continue
          providerGrants.set(
            key,
            grants.filter((grant) => grant.providerID !== providerID),
          )
        }
      },
    },
    sessions: {
      async create(input) {
        const existingIdx = sessionRecords.findIndex((record) => record.sessionID === input.sessionID)
        const item: SessionAudit = {
          ...input,
          id: existingIdx >= 0 ? sessionRecords[existingIdx].id : crypto.randomUUID(),
          createdAt: existingIdx >= 0 ? sessionRecords[existingIdx].createdAt : new Date().toISOString(),
        }
        if (existingIdx >= 0) {
          sessionRecords[existingIdx] = item
        } else {
          sessionRecords.push(item)
        }
        return item
      },
      async listByUser(userID, limit = 50) {
        return sessionRecords
          .filter((record) => record.userID === userID)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(0, limit)
      },
      async listByOrg(orgID, options = {}) {
        const { userID, search, limit = 50, offset = 0 } = options
        const normalizedSearch = search?.trim().toLowerCase()
        return sessionRecords
          .filter((record) => {
            if (record.orgID !== orgID) return false
            if (userID && record.userID !== userID) return false
            if (normalizedSearch) {
              const inTitle = record.title.toLowerCase().includes(normalizedSearch)
              const inSummary = record.summary.toLowerCase().includes(normalizedSearch)
              const inWorkspace = record.workspace.toLowerCase().includes(normalizedSearch)
              const inSessionID = record.sessionID.toLowerCase().includes(normalizedSearch)
              if (!inTitle && !inSummary && !inWorkspace && !inSessionID) return false
            }
            return true
          })
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .slice(offset, offset + limit)
      },
      async findBySessionID(sessionID) {
        return sessionRecords.find((record) => record.sessionID === sessionID)
      },
      async getUserKPIs(userID) {
        const userSessions = sessionRecords.filter((record) => record.userID === userID)
        return {
          totalSessions: userSessions.length,
          totalTokens: userSessions.reduce((acc, curr) => acc + (curr.tokensTotal || 0), 0),
          totalCostUsd: userSessions.reduce((acc, curr) => acc + (curr.costUsd || 0), 0),
          totalDurationMs: userSessions.reduce((acc, curr) => acc + (curr.durationMs || 0), 0),
        }
      },
      async getOrgKPIs(orgID) {
        const orgSessions = sessionRecords.filter((record) => record.orgID === orgID)
        return {
          totalSessions: orgSessions.length,
          totalTokens: orgSessions.reduce((acc, curr) => acc + (curr.tokensTotal || 0), 0),
          totalCostUsd: orgSessions.reduce((acc, curr) => acc + (curr.costUsd || 0), 0),
          totalDurationMs: orgSessions.reduce((acc, curr) => acc + (curr.durationMs || 0), 0),
        }
      },
      async getUserModelUsage(userID, options = {}) {
        const { days = 30 } = options
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        const userSessions = sessionRecords.filter(
          (record) => record.userID === userID && record.startedAt >= cutoff,
        )
        const summaryMap = new Map<string, ModelUsageSummary>()
        for (const session of userSessions) {
          const sessionKeysSeen = new Set<string>()
          for (const usage of session.modelUsage || []) {
            const key = `${usage.providerID}:${usage.modelID}`
            const existing = summaryMap.get(key) ?? {
              providerID: usage.providerID,
              modelID: usage.modelID,
              tokens: 0,
              costUsd: 0,
              calls: 0,
              sessions: 0,
            }
            existing.tokens += usage.tokens
            existing.costUsd += usage.costUsd
            existing.calls += usage.calls
            if (!sessionKeysSeen.has(key)) {
              existing.sessions += 1
              sessionKeysSeen.add(key)
            }
            summaryMap.set(key, existing)
          }
        }
        return [...summaryMap.values()].sort((a, b) => b.tokens - a.tokens)
      },
    },
    credentials: {
      async listByUser(userID) {
        return [...credentials.values()]
          .filter((cred) => cred.userID === userID)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      },
      async findByUserAndProvider(userID, providerID) {
        return credentials.get(`${userID}:${providerID}`)
      },
      async set(userID, providerID, apiKey) {
        const key = `${userID}:${providerID}`
        const existing = credentials.get(key)
        const now = new Date().toISOString()
        credentials.set(key, {
          userID,
          providerID,
          apiKey,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        })
      },
      async remove(userID, providerID) {
        credentials.delete(`${userID}:${providerID}`)
      },
    },
    audit: {
      async log(input) {
        const event: AuditEvent = {
          ...input,
          id: crypto.randomUUID(),
          orgID: input.orgID ?? DEFAULT_ORG_ID,
          at: new Date().toISOString(),
        }
        events.unshift(event)
        if (events.length > 500) events.pop()
        return event
      },
      async list(orgID, limit = 50) {
        const filtered = orgID ? events.filter((e) => e.orgID === orgID) : events
        return filtered.slice(0, limit)
      },
      async forTarget(targetID, limit = 20) {
        return events.filter((event) => event.targetID === targetID).slice(0, limit)
      },
    },
  }
}

type UserRow = {
  id: string
  org_id: string
  name: string
  email: string
  role: string
  status: string
  password_hash: string
  must_change_password: number
  is_platform_admin?: number
  can_use_agentui?: number
  can_use_routines?: number
  can_change_password?: number
  can_open_settings?: number | null
  default_provider?: string | null
  default_model?: string | null
  access_overrides?: string | null
  app_version?: string | null
  app_version_at?: string | null
  created_at: string
  last_login_at: string | null
}

type OrgRow = {
  id: string
  name: string
  slug: string
  status?: string
  max_users?: number
  contact_email?: string | null
  logo_url?: string | null
  welcome_message?: string | null
  brand_color?: string | null
  sso_mode: string
  offline_grace_hours: number
  session_max_age_hours: number
  default_provider?: string | null
  default_model?: string | null
  provider_policy?: string | null
  allow_local_providers?: number | null
  created_at: string
}

type GroupRow = {
  id: string
  org_id: string
  name: string
  description: string | null
  access: string
  can_open_settings: number
  created_at: string
}

type ProviderRow = {
  id: string
  org_id: string
  provider_id: string
  display_name: string
  kind: string
  protocol: string | null
  npm: string | null
  base_url: string | null
  api_key: string | null
  models_json: string
  headers_json: string
  env_json: string
  enabled: number
  created_by: string | null
  created_at: string
  updated_at: string
}

type ProviderGrantRow = {
  scope: string
  scope_id: string
  provider_id: string
  effect: string
}

type UserProviderCredentialRow = {
  user_id: string
  provider_id: string
  api_key: string
  created_at: string
  updated_at: string
}

type AuditRow = {
  id: string
  org_id: string
  actor_id: string | null
  actor_email: string
  action: string
  target_type: string | null
  target_id: string | null
  result: string
  at: string
}

type SessionAuditRow = {
  id: string
  session_id: string
  user_id: string
  org_id: string
  title: string | null
  summary: string
  workspace: string
  started_at: string
  ended_at: string | null
  tokens_total: number
  tokens_input: number
  tokens_output: number
  tokens_reasoning: number
  cost_usd: number
  duration_ms: number
  messages_count: number
  model_usage?: string | null
  created_at: string
}

function toUser(row: UserRow): PanelUser {
  return {
    id: row.id,
    orgID: row.org_id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    status: row.status as Status,
    passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password === 1,
    isPlatformAdmin: row.is_platform_admin === 1,
    canUseAgentUI: row.can_use_agentui !== 0,
    canUseRoutines: row.can_use_routines !== 0,
    canChangePassword: row.can_change_password !== 0,
    canOpenSettings:
      row.can_open_settings === null || row.can_open_settings === undefined
        ? undefined
        : row.can_open_settings !== 0,
    defaultProvider: row.default_provider ?? undefined,
    defaultModel: row.default_model ?? undefined,
    accessOverrides: row.access_overrides ?? "{}",
    appVersion: row.app_version ?? undefined,
    appVersionAt: row.app_version_at ?? undefined,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? undefined,
  }
}

function toGroup(row: GroupRow): AccessGroup {
  return {
    id: row.id,
    orgID: row.org_id,
    name: row.name,
    description: row.description ?? undefined,
    access: row.access,
    canOpenSettings: row.can_open_settings !== 0,
    createdAt: row.created_at,
  }
}

function parseModelUsage(value: string | null | undefined): ModelUsageEntry[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as ModelUsageEntry[]) : []
  } catch {
    return []
  }
}

function toSessionAudit(row: SessionAuditRow): SessionAudit {
  return {
    id: row.id,
    sessionID: row.session_id,
    userID: row.user_id,
    orgID: row.org_id,
    title: row.title ?? "Sessão sem título",
    summary: row.summary,
    workspace: row.workspace,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    tokensTotal: row.tokens_total ?? 0,
    tokensInput: row.tokens_input ?? 0,
    tokensOutput: row.tokens_output ?? 0,
    tokensReasoning: row.tokens_reasoning ?? 0,
    costUsd: row.cost_usd ?? 0,
    durationMs: row.duration_ms ?? 0,
    messagesCount: row.messages_count ?? 0,
    modelUsage: parseModelUsage(row.model_usage),
    createdAt: row.created_at,
  }
}

function toCredential(row: UserProviderCredentialRow): UserProviderCredential {
  return {
    userID: row.user_id,
    providerID: row.provider_id,
    apiKey: row.api_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status === "suspended" ? "suspended" : "active",
    maxUsers: row.max_users ?? 10,
    contactEmail: row.contact_email ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    welcomeMessage: row.welcome_message ?? undefined,
    brandColor: row.brand_color ?? undefined,
    ssoMode: row.sso_mode === "required" ? "required" : "optional",
    offlineGraceHours: row.offline_grace_hours,
    sessionMaxAgeHours: row.session_max_age_hours,
    defaultProvider: row.default_provider ?? undefined,
    defaultModel: row.default_model ?? undefined,
    providerRestricted: row.provider_policy === "restricted",
    allowLocalProviders: row.allow_local_providers !== 0,
    createdAt: row.created_at,
  }
}

function toProvider(row: ProviderRow): ProviderDefinition {
  return {
    id: row.id,
    orgID: row.org_id,
    providerID: row.provider_id,
    displayName: row.display_name,
    kind: row.kind === "custom" ? "custom" : row.kind === "proxy" ? "proxy" : "builtin",
    protocol: (row.protocol === "anthropic" ? "anthropic" : "openai") as ProviderProtocol,
    npm: row.npm ?? undefined,
    baseURL: row.base_url ?? undefined,
    apiKey: row.api_key ?? undefined,
    models: parseJsonArray<ProviderModel>(row.models_json),
    headers: parseJsonArray<ProviderHeader>(row.headers_json),
    env: parseJsonArray<string>(row.env_json),
    enabled: row.enabled !== 0,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toProviderGrant(row: ProviderGrantRow): ProviderGrant {
  return {
    scope: row.scope === "user" ? "user" : "group",
    scopeID: row.scope_id,
    providerID: row.provider_id,
    effect: row.effect === "deny" ? "deny" : "allow",
  }
}

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return []
  const parsed: unknown = JSON.parse(value)
  return Array.isArray(parsed) ? (parsed as T[]) : []
}

function toAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    orgID: row.org_id,
    actorID: row.actor_id ?? undefined,
    actorEmail: row.actor_email,
    action: row.action,
    targetType: row.target_type ?? undefined,
    targetID: row.target_id ?? undefined,
    result: row.result === "allow" ? "allow" : "deny",
    at: row.at,
  }
}

export function d1Store(db: D1Database): Store {
  let seeding: Promise<void> | undefined

  const orgGet = async (id = DEFAULT_ORG_ID) => {
    const row = await db.prepare("SELECT * FROM organization WHERE id = ?").bind(id).first<OrgRow>()
    return row ? toOrg(row) : { ...defaultOrg(), id }
  }

  const userFindByID = async (id: string) => {
    const row = await db.prepare("SELECT * FROM panel_user WHERE id = ?").bind(id).first<UserRow>()
    return row ? toUser(row) : undefined
  }

  return {
    ensureSeed() {
      seeding ??= (async () => {
        const now = new Date().toISOString()
        const org = defaultOrg()
        await db
          .prepare(
            `INSERT INTO organization (id, name, slug, status, max_users, contact_email, sso_mode, offline_grace_hours, session_max_age_hours, created_at)
             VALUES (?, ?, ?, 'active', 50, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO NOTHING`,
          )
          .bind(
            org.id,
            org.name,
            org.slug,
            org.contactEmail ?? "admin@allcode.dev",
            org.ssoMode,
            org.offlineGraceHours,
            org.sessionMaxAgeHours,
            now,
          )
          .run()

        const email = seedEmail()
        const existing = await db.prepare("SELECT id FROM panel_user WHERE email = ?").bind(email).first()
        if (existing) {
          // Garante permissões de superadmin para o utilizador proprietário
          await db.prepare("UPDATE panel_user SET is_platform_admin = 1 WHERE email = ?").bind(email).run()
          return
        }
        await db
          .prepare(
            `INSERT INTO panel_user (id, org_id, name, email, role, status, password_hash, must_change_password, is_platform_admin, can_use_agentui, can_use_routines, can_change_password, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 1, ?)
             ON CONFLICT(email) DO NOTHING`,
          )
          .bind(
            crypto.randomUUID(),
            DEFAULT_ORG_ID,
            "Administrador",
            email,
            "owner",
            "active",
            await hashPassword(seedPassword()),
            0,
            now,
          )
          .run()
      })()
      return seeding
    },
    org: {
      get: orgGet,
      async list() {
        const rows = await db.prepare("SELECT * FROM organization ORDER BY name ASC").all<OrgRow>()
        return rows.results.map(toOrg)
      },
      async findBySlug(slug: string) {
        const row = await db.prepare("SELECT * FROM organization WHERE slug = ?").bind(slug.trim().toLowerCase()).first<OrgRow>()
        return row ? toOrg(row) : undefined
      },
      async create(input) {
        const newOrg: Organization = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          status: "active",
          maxUsers: input.maxUsers ?? 10,
          contactEmail: input.contactEmail,
          ssoMode: "optional",
          offlineGraceHours: 72,
          sessionMaxAgeHours: 12,
          providerRestricted: false,
          allowLocalProviders: true,
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO organization (id, name, slug, status, max_users, contact_email, sso_mode, offline_grace_hours, session_max_age_hours, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newOrg.id,
            newOrg.name,
            newOrg.slug,
            newOrg.status,
            newOrg.maxUsers,
            newOrg.contactEmail ?? null,
            newOrg.ssoMode,
            newOrg.offlineGraceHours,
            newOrg.sessionMaxAgeHours,
            newOrg.createdAt,
          )
          .run()
        return newOrg
      },
      async update(id, patch) {
        const current = await orgGet(id)
        const next = { ...current, ...patch }
        await db
          .prepare(
            `UPDATE organization SET name = ?, slug = ?, status = ?, max_users = ?, contact_email = ?, logo_url = ?, welcome_message = ?, brand_color = ?, sso_mode = ?, offline_grace_hours = ?, session_max_age_hours = ?, default_provider = ?, default_model = ?, provider_policy = ?, allow_local_providers = ? WHERE id = ?`,
          )
          .bind(
            next.name,
            next.slug,
            next.status,
            next.maxUsers,
            next.contactEmail ?? null,
            next.logoUrl ?? null,
            next.welcomeMessage ?? null,
            next.brandColor ?? null,
            next.ssoMode,
            next.offlineGraceHours,
            next.sessionMaxAgeHours,
            next.defaultProvider ?? null,
            next.defaultModel ?? null,
            next.providerRestricted ? "restricted" : null,
            next.allowLocalProviders ? 1 : 0,
            id,
          )
          .run()
        return next
      },
      async stats() {
        const orgStats = await db
          .prepare(
            `SELECT
               COUNT(*) as total_tenants,
               SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_tenants,
               SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_tenants
             FROM organization`,
          )
          .first<{ total_tenants: number; active_tenants: number; suspended_tenants: number }>()

        const userCount = await db
          .prepare("SELECT COUNT(*) as total FROM panel_user WHERE status != 'deleted'")
          .first<{ total: number }>()

        return {
          totalTenants: Number(orgStats?.total_tenants ?? 0),
          activeTenants: Number(orgStats?.active_tenants ?? 0),
          suspendedTenants: Number(orgStats?.suspended_tenants ?? 0),
          totalUsersAcrossTenants: Number(userCount?.total ?? 0),
        }
      },
    },
    users: {
      async list(orgID) {
        const query = orgID
          ? db.prepare("SELECT * FROM panel_user WHERE status != 'deleted' AND org_id = ? ORDER BY name ASC").bind(orgID)
          : db.prepare("SELECT * FROM panel_user WHERE status != 'deleted' ORDER BY name ASC")
        const rows = await query.all<UserRow>()
        return rows.results.map(toUser)
      },
      findByID: userFindByID,
      async findByEmail(email) {
        const row = await db
          .prepare("SELECT * FROM panel_user WHERE email = ?")
          .bind(email.trim().toLowerCase())
          .first<UserRow>()
        return row ? toUser(row) : undefined
      },
      async create(input) {
        const user: PanelUser = {
          id: crypto.randomUUID(),
          orgID: input.orgID ?? DEFAULT_ORG_ID,
          name: input.name,
          email: input.email.toLowerCase(),
          role: input.role,
          status: "invited",
          passwordHash: input.passwordHash,
          mustChangePassword: input.mustChangePassword,
          isPlatformAdmin: input.isPlatformAdmin ?? false,
          canUseAgentUI: input.canUseAgentUI ?? true,
          canUseRoutines: input.canUseRoutines ?? true,
          canChangePassword: input.canChangePassword ?? true,
          canOpenSettings: input.canOpenSettings ?? true,
          defaultProvider: input.defaultProvider,
          defaultModel: input.defaultModel,
          accessOverrides: JSON.stringify(input.accessOverrides ?? {}),
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO panel_user (id, org_id, name, email, role, status, password_hash, must_change_password, is_platform_admin, can_use_agentui, can_use_routines, can_change_password, can_open_settings, default_provider, default_model, access_overrides, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            user.id,
            user.orgID,
            user.name,
            user.email,
            user.role,
            user.status,
            user.passwordHash,
            user.mustChangePassword ? 1 : 0,
            user.isPlatformAdmin ? 1 : 0,
            user.canUseAgentUI ? 1 : 0,
            user.canUseRoutines ? 1 : 0,
            user.canChangePassword ? 1 : 0,
            user.canOpenSettings === undefined ? null : user.canOpenSettings ? 1 : 0,
            user.defaultProvider ?? null,
            user.defaultModel ?? null,
            user.accessOverrides,
            user.createdAt,
          )
          .run()
        return user
      },
      async update(id, patch) {
        const current = await userFindByID(id)
        if (!current) return
        const next = { ...current, ...patch }
        await db
          .prepare(
            `UPDATE panel_user SET name = ?, email = ?, role = ?, status = ?, password_hash = ?, must_change_password = ?, last_login_at = ?, can_use_agentui = ?, can_use_routines = ?, can_change_password = ?, can_open_settings = ?, default_provider = ?, default_model = ?, access_overrides = ?, app_version = ?, app_version_at = ? WHERE id = ?`,
          )
          .bind(
            next.name,
            next.email,
            next.role,
            next.status,
            next.passwordHash,
            next.mustChangePassword ? 1 : 0,
            next.lastLoginAt ?? null,
            next.canUseAgentUI ? 1 : 0,
            next.canUseRoutines ? 1 : 0,
            next.canChangePassword ? 1 : 0,
            next.canOpenSettings === undefined ? null : next.canOpenSettings ? 1 : 0,
            next.defaultProvider ?? null,
            next.defaultModel ?? null,
            next.accessOverrides ?? "{}",
            next.appVersion ?? null,
            next.appVersionAt ?? null,
            id,
          )
          .run()
        return next
      },
      async count(orgID) {
        const query = orgID
          ? db
              .prepare(
                `SELECT
                   COUNT(*) AS total,
                   SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                   SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) AS invited,
                   SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
                 FROM panel_user WHERE status != 'deleted' AND org_id = ?`,
              )
              .bind(orgID)
          : db.prepare(
              `SELECT
                 COUNT(*) AS total,
                 SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                 SUM(CASE WHEN status = 'invited' THEN 1 ELSE 0 END) AS invited,
                 SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
               FROM panel_user WHERE status != 'deleted'`,
            )

        const row = await query.first<{ total: number; active: number; invited: number; suspended: number }>()
        return {
          total: Number(row?.total ?? 0),
          active: Number(row?.active ?? 0),
          invited: Number(row?.invited ?? 0),
          suspended: Number(row?.suspended ?? 0),
        }
      },
    },
    groups: {
      async list(orgID) {
        const query = orgID
          ? db.prepare("SELECT * FROM access_group WHERE org_id = ? ORDER BY name ASC").bind(orgID)
          : db.prepare("SELECT * FROM access_group ORDER BY name ASC")
        const rows = await query.all<GroupRow>()
        return rows.results.map(toGroup)
      },
      async findByID(id) {
        const row = await db.prepare("SELECT * FROM access_group WHERE id = ?").bind(id).first<GroupRow>()
        return row ? toGroup(row) : undefined
      },
      async create(input) {
        const group: AccessGroup = {
          id: crypto.randomUUID(),
          orgID: input.orgID ?? DEFAULT_ORG_ID,
          name: input.name,
          description: input.description,
          access: JSON.stringify(input.access ?? {}),
          canOpenSettings: input.canOpenSettings ?? true,
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO access_group (id, org_id, name, description, access, can_open_settings, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            group.id,
            group.orgID,
            group.name,
            group.description ?? null,
            group.access,
            group.canOpenSettings ? 1 : 0,
            group.createdAt,
          )
          .run()
        return group
      },
      async update(id, patch) {
        const row = await db.prepare("SELECT * FROM access_group WHERE id = ?").bind(id).first<GroupRow>()
        const current = row ? toGroup(row) : undefined
        if (!current) return
        const next = {
          ...current,
          ...patch,
          access: patch.access ? JSON.stringify(patch.access) : current.access,
        }
        await db
          .prepare(
            "UPDATE access_group SET name = ?, description = ?, access = ?, can_open_settings = ? WHERE id = ?",
          )
          .bind(
            next.name,
            next.description ?? null,
            next.access,
            next.canOpenSettings ? 1 : 0,
            id,
          )
          .run()
        return next
      },
      async remove(id) {
        await db.prepare("DELETE FROM access_group_member WHERE group_id = ?").bind(id).run()
        await db.prepare("DELETE FROM access_group WHERE id = ?").bind(id).run()
      },
      async members(groupID) {
        const rows = await db
          .prepare("SELECT user_id FROM access_group_member WHERE group_id = ?")
          .bind(groupID)
          .all<{ user_id: string }>()
        return rows.results.map((row) => row.user_id)
      },
      async groupsForUser(userID) {
        const rows = await db
          .prepare(
            `SELECT g.* FROM access_group g
             JOIN access_group_member m ON m.group_id = g.id
             WHERE m.user_id = ? ORDER BY g.name ASC`,
          )
          .bind(userID)
          .all<GroupRow>()
        return rows.results.map(toGroup)
      },
      async setMembers(groupID, userIDs) {
        await db.prepare("DELETE FROM access_group_member WHERE group_id = ?").bind(groupID).run()
        for (const userID of userIDs) {
          await db
            .prepare("INSERT OR IGNORE INTO access_group_member (group_id, user_id, created_at) VALUES (?, ?, ?)")
            .bind(groupID, userID, new Date().toISOString())
            .run()
        }
      },
      async setUserGroups(userID, groupIDs) {
        await db.prepare("DELETE FROM access_group_member WHERE user_id = ?").bind(userID).run()
        for (const groupID of groupIDs) {
          await db
            .prepare("INSERT OR IGNORE INTO access_group_member (group_id, user_id, created_at) VALUES (?, ?, ?)")
            .bind(groupID, userID, new Date().toISOString())
            .run()
        }
      },
    },
    providers: {
      async list(orgID) {
        const query = orgID
          ? db.prepare("SELECT * FROM provider_definition WHERE org_id = ? ORDER BY display_name ASC").bind(orgID)
          : db.prepare("SELECT * FROM provider_definition ORDER BY display_name ASC")
        const rows = await query.all<ProviderRow>()
        return rows.results.map(toProvider)
      },
      async findByID(id) {
        const row = await db.prepare("SELECT * FROM provider_definition WHERE id = ?").bind(id).first<ProviderRow>()
        return row ? toProvider(row) : undefined
      },
      async findByProviderID(orgID, providerID) {
        const row = await db
          .prepare("SELECT * FROM provider_definition WHERE org_id = ? AND provider_id = ?")
          .bind(orgID, providerID)
          .first<ProviderRow>()
        return row ? toProvider(row) : undefined
      },
      async create(input) {
        const now = new Date().toISOString()
        const provider: ProviderDefinition = {
          id: crypto.randomUUID(),
          orgID: input.orgID,
          providerID: input.providerID,
          displayName: input.displayName,
          kind: input.kind ?? "builtin",
          protocol: input.protocol ?? "openai",
          npm: input.npm,
          baseURL: input.baseURL,
          apiKey: input.apiKey,
          models: input.models ?? [],
          headers: input.headers ?? [],
          env: input.env ?? [],
          enabled: input.enabled ?? true,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        }
        await db
          .prepare(
            `INSERT INTO provider_definition (id, org_id, provider_id, display_name, kind, protocol, npm, base_url, api_key, models_json, headers_json, env_json, enabled, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            provider.id,
            provider.orgID,
            provider.providerID,
            provider.displayName,
            provider.kind,
            provider.protocol,
            provider.npm ?? null,
            provider.baseURL ?? null,
            provider.apiKey ?? null,
            JSON.stringify(provider.models),
            JSON.stringify(provider.headers),
            JSON.stringify(provider.env),
            provider.enabled ? 1 : 0,
            provider.createdBy ?? null,
            provider.createdAt,
            provider.updatedAt,
          )
          .run()
        return provider
      },
      async update(id, patch) {
        const row = await db.prepare("SELECT * FROM provider_definition WHERE id = ?").bind(id).first<ProviderRow>()
        if (!row) return
        const next: ProviderDefinition = {
          ...toProvider(row),
          ...patch,
          updatedAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `UPDATE provider_definition SET display_name = ?, protocol = ?, npm = ?, base_url = ?, api_key = ?, models_json = ?, headers_json = ?, env_json = ?, enabled = ?, updated_at = ? WHERE id = ?`,
          )
          .bind(
            next.displayName,
            next.protocol,
            next.npm ?? null,
            next.baseURL ?? null,
            next.apiKey ?? null,
            JSON.stringify(next.models),
            JSON.stringify(next.headers),
            JSON.stringify(next.env),
            next.enabled ? 1 : 0,
            next.updatedAt,
            id,
          )
          .run()
        return next
      },
      async remove(id) {
        const row = await db.prepare("SELECT org_id, provider_id FROM provider_definition WHERE id = ?").bind(id).first<{
          org_id: string
          provider_id: string
        }>()
        await db.prepare("DELETE FROM provider_definition WHERE id = ?").bind(id).run()
        if (!row) return
        await db
          .prepare(
            `DELETE FROM provider_grant WHERE provider_id = ? AND (
               (scope = 'group' AND scope_id IN (SELECT id FROM access_group WHERE org_id = ?)) OR
               (scope = 'user' AND scope_id IN (SELECT id FROM panel_user WHERE org_id = ?))
             )`,
          )
          .bind(row.provider_id, row.org_id, row.org_id)
          .run()
      },
      async grants(scope, scopeID) {
        const rows = await db
          .prepare("SELECT * FROM provider_grant WHERE scope = ? AND scope_id = ?")
          .bind(scope, scopeID)
          .all<ProviderGrantRow>()
        return rows.results.map(toProviderGrant)
      },
      async grantsForScopes(scope, scopeIDs) {
        if (scopeIDs.length === 0) return []
        const placeholders = scopeIDs.map(() => "?").join(", ")
        const rows = await db
          .prepare(`SELECT * FROM provider_grant WHERE scope = ? AND scope_id IN (${placeholders})`)
          .bind(scope, ...scopeIDs)
          .all<ProviderGrantRow>()
        return rows.results.map(toProviderGrant)
      },
      async setGrants(scope, scopeID, grants) {
        await db.prepare("DELETE FROM provider_grant WHERE scope = ? AND scope_id = ?").bind(scope, scopeID).run()
        for (const grant of grants) {
          await db
            .prepare("INSERT OR REPLACE INTO provider_grant (scope, scope_id, provider_id, effect, created_at) VALUES (?, ?, ?, ?, ?)")
            .bind(scope, scopeID, grant.providerID, grant.effect, new Date().toISOString())
            .run()
        }
      },
      async removeGrantsForProvider(orgID, providerID) {
        await db
          .prepare(
            `DELETE FROM provider_grant WHERE provider_id = ? AND (
               (scope = 'group' AND scope_id IN (SELECT id FROM access_group WHERE org_id = ?)) OR
               (scope = 'user' AND scope_id IN (SELECT id FROM panel_user WHERE org_id = ?))
             )`,
          )
          .bind(providerID, orgID, orgID)
          .run()
      },
    },
    sessions: {
      async create(input) {
        const item: SessionAudit = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO session_audit (id, session_id, user_id, org_id, title, summary, workspace, started_at, ended_at, tokens_total, tokens_input, tokens_output, tokens_reasoning, cost_usd, duration_ms, messages_count, model_usage, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(session_id) DO UPDATE SET
               title = excluded.title,
               summary = excluded.summary,
               workspace = excluded.workspace,
               ended_at = excluded.ended_at,
               tokens_total = excluded.tokens_total,
               tokens_input = excluded.tokens_input,
               tokens_output = excluded.tokens_output,
               tokens_reasoning = excluded.tokens_reasoning,
               cost_usd = excluded.cost_usd,
               duration_ms = excluded.duration_ms,
               messages_count = excluded.messages_count,
               model_usage = excluded.model_usage`,
          )
          .bind(
            item.id,
            item.sessionID,
            item.userID,
            item.orgID,
            item.title,
            item.summary,
            item.workspace,
            item.startedAt,
            item.endedAt ?? null,
            item.tokensTotal,
            item.tokensInput,
            item.tokensOutput,
            item.tokensReasoning,
            item.costUsd,
            item.durationMs,
            item.messagesCount,
            JSON.stringify(item.modelUsage ?? []),
            item.createdAt,
          )
          .run()
        return item
      },
      async listByUser(userID, limit = 50) {
        const rows = await db
          .prepare("SELECT * FROM session_audit WHERE user_id = ? ORDER BY started_at DESC LIMIT ?")
          .bind(userID, limit)
          .all<SessionAuditRow>()
        return rows.results.map(toSessionAudit)
      },
      async listByOrg(orgID, options = {}) {
        const { userID, search, limit = 50, offset = 0 } = options
        const clauses: string[] = ["org_id = ?"]
        const bindings: (string | number)[] = [orgID]

        if (userID) {
          clauses.push("user_id = ?")
          bindings.push(userID)
        }

        if (search?.trim()) {
          clauses.push("(title LIKE ? OR summary LIKE ? OR workspace LIKE ? OR session_id LIKE ?)")
          const term = `%${search.trim()}%`
          bindings.push(term, term, term, term)
        }

        bindings.push(limit, offset)

        const rows = await db
          .prepare(
            `SELECT * FROM session_audit
             WHERE ${clauses.join(" AND ")}
             ORDER BY started_at DESC
             LIMIT ? OFFSET ?`,
          )
          .bind(...bindings)
          .all<SessionAuditRow>()

        return rows.results.map(toSessionAudit)
      },
      async findBySessionID(sessionID) {
        const row = await db
          .prepare("SELECT * FROM session_audit WHERE session_id = ?")
          .bind(sessionID)
          .first<SessionAuditRow>()
        return row ? toSessionAudit(row) : undefined
      },
      async getUserKPIs(userID) {
        const row = await db
          .prepare(
            `SELECT
               COUNT(*) AS total_sessions,
               SUM(tokens_total) AS total_tokens,
               SUM(cost_usd) AS total_cost_usd,
               SUM(duration_ms) AS total_duration_ms
             FROM session_audit WHERE user_id = ?`,
          )
          .bind(userID)
          .first<{ total_sessions: number; total_tokens: number; total_cost_usd: number; total_duration_ms: number }>()
        return {
          totalSessions: Number(row?.total_sessions ?? 0),
          totalTokens: Number(row?.total_tokens ?? 0),
          totalCostUsd: Number(row?.total_cost_usd ?? 0),
          totalDurationMs: Number(row?.total_duration_ms ?? 0),
        }
      },
      async getOrgKPIs(orgID) {
        const row = await db
          .prepare(
            `SELECT
               COUNT(*) AS total_sessions,
               SUM(tokens_total) AS total_tokens,
               SUM(cost_usd) AS total_cost_usd,
               SUM(duration_ms) AS total_duration_ms
             FROM session_audit WHERE org_id = ?`,
          )
          .bind(orgID)
          .first<{ total_sessions: number; total_tokens: number; total_cost_usd: number; total_duration_ms: number }>()
        return {
          totalSessions: Number(row?.total_sessions ?? 0),
          totalTokens: Number(row?.total_tokens ?? 0),
          totalCostUsd: Number(row?.total_cost_usd ?? 0),
          totalDurationMs: Number(row?.total_duration_ms ?? 0),
        }
      },
      async getUserModelUsage(userID, options = {}) {
        const { days = 30 } = options
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        const rows = await db
          .prepare("SELECT model_usage FROM session_audit WHERE user_id = ? AND started_at >= ?")
          .bind(userID, cutoff)
          .all<{ model_usage: string | null }>()

        const summaryMap = new Map<string, ModelUsageSummary>()
        for (const row of rows.results) {
          const list = parseModelUsage(row.model_usage)
          const sessionKeysSeen = new Set<string>()
          for (const usage of list) {
            const key = `${usage.providerID}:${usage.modelID}`
            const existing = summaryMap.get(key) ?? {
              providerID: usage.providerID,
              modelID: usage.modelID,
              tokens: 0,
              costUsd: 0,
              calls: 0,
              sessions: 0,
            }
            existing.tokens += usage.tokens
            existing.costUsd += usage.costUsd
            existing.calls += usage.calls
            if (!sessionKeysSeen.has(key)) {
              existing.sessions += 1
              sessionKeysSeen.add(key)
            }
            summaryMap.set(key, existing)
          }
        }
        return [...summaryMap.values()].sort((a, b) => b.tokens - a.tokens)
      },
    },
    credentials: {
      async listByUser(userID) {
        const rows = await db
          .prepare("SELECT * FROM user_provider_credential WHERE user_id = ? ORDER BY created_at ASC")
          .bind(userID)
          .all<UserProviderCredentialRow>()
        return rows.results.map(toCredential)
      },
      async findByUserAndProvider(userID, providerID) {
        const row = await db
          .prepare("SELECT * FROM user_provider_credential WHERE user_id = ? AND provider_id = ?")
          .bind(userID, providerID)
          .first<UserProviderCredentialRow>()
        return row ? toCredential(row) : undefined
      },
      async set(userID, providerID, apiKey) {
        const now = new Date().toISOString()
        await db
          .prepare(
            `INSERT INTO user_provider_credential (user_id, provider_id, api_key, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id, provider_id) DO UPDATE SET
               api_key = excluded.api_key,
               updated_at = excluded.updated_at`,
          )
          .bind(userID, providerID, apiKey, now, now)
          .run()
      },
      async remove(userID, providerID) {
        await db
          .prepare("DELETE FROM user_provider_credential WHERE user_id = ? AND provider_id = ?")
          .bind(userID, providerID)
          .run()
      },
    },
    audit: {
      async log(input) {
        const event: AuditEvent = {
          ...input,
          id: crypto.randomUUID(),
          orgID: input.orgID ?? DEFAULT_ORG_ID,
          at: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO audit_event (id, org_id, actor_id, actor_email, action, target_type, target_id, result, at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            event.id,
            event.orgID,
            event.actorID ?? null,
            event.actorEmail,
            event.action,
            event.targetType ?? null,
            event.targetID ?? null,
            event.result,
            event.at,
          )
          .run()
        return event
      },
      async list(orgID, limit = 50) {
        const query = orgID
          ? db.prepare("SELECT * FROM audit_event WHERE org_id = ? ORDER BY at DESC LIMIT ?").bind(orgID, limit)
          : db.prepare("SELECT * FROM audit_event ORDER BY at DESC LIMIT ?").bind(limit)
        const rows = await query.all<AuditRow>()
        return rows.results.map(toAudit)
      },
      async forTarget(targetID, limit = 20) {
        const rows = await db
          .prepare("SELECT * FROM audit_event WHERE target_id = ? ORDER BY at DESC LIMIT ?")
          .bind(targetID, limit)
          .all<AuditRow>()
        return rows.results.map(toAudit)
      },
    },
  }
}

let memory: Store | undefined
const d1Stores = new WeakMap<D1Database, Store>()

export function store(): Store {
  const db = bindings().DB
  if (!db) return (memory ??= memoryStore())
  const cached = d1Stores.get(db)
  if (cached) return cached
  const created = d1Store(db)
  d1Stores.set(db, created)
  return created
}
