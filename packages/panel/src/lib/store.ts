import { hashPassword } from "./crypto"
import { bindings, env } from "./env"
import { computeComparativeSavings, type ReferenceRatesConfig } from "./kpi-pricing"

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
  isReseller?: boolean
  resellerID?: string
  canUseAgentUI: boolean
  canUseRoutines: boolean
  canChangePassword: boolean
  auditExempt?: boolean
  /** undefined = inherit from the access groups. */
  canOpenSettings?: boolean
  defaultProvider?: string
  defaultModel?: string
  /** Individual token quota. undefined = no sub-limit (uses only the company pool). */
  tokenQuota?: number
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
  scope: "company" | "global"
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
  tokensInput: number
  tokensOutput: number
  tokensReasoning: number
  totalCostUsd: number
  totalDurationMs: number
  referenceCostAnthropic: number
  referenceCostOpenAI: number
  referenceMarketCost: number
  savingsUsd: number
  savingsPercentage: number
}

export type OrgKPIs = UserKPIs

export const EMPTY_USER_KPIS: UserKPIs = {
  totalSessions: 0,
  totalTokens: 0,
  tokensInput: 0,
  tokensOutput: 0,
  tokensReasoning: 0,
  totalCostUsd: 0,
  totalDurationMs: 0,
  referenceCostAnthropic: 0,
  referenceCostOpenAI: 0,
  referenceMarketCost: 0,
  savingsUsd: 0,
  savingsPercentage: 0,
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
  resellerID?: string
  planType: "trial" | "paid"
  trialEndsAt?: string
  planID?: string
  /** Shared token pool for every user in the company. undefined = unlimited. */
  tokenQuota?: number
  /** Default per-user quota for users without an individual override. */
  userTokenQuota?: number
  /** Day of the month (UTC) that starts the billing cycle. */
  tokenQuotaCycleDay?: number
  createdAt: string
}

export type PlanPricingMode = "per_user" | "package"

export type Plan = {
  id: string
  name: string
  slug: string
  description?: string
  pricingMode: PlanPricingMode
  /** Monthly price. Per user when pricingMode is "per_user", total when "package". */
  priceCents: number
  /** Seats included in a fixed package. */
  includedUsers?: number
  /** Price per seat beyond the package allowance. */
  extraUserPriceCents?: number
  minUsers: number
  maxUsers?: number
  isActive: boolean
  sortOrder: number
  createdAt: string
}

export type PlanInput = {
  name: string
  slug: string
  description?: string
  pricingMode?: PlanPricingMode
  priceCents?: number
  includedUsers?: number
  extraUserPriceCents?: number
  minUsers?: number
  maxUsers?: number
  isActive?: boolean
  sortOrder?: number
}

export type PlanPatch = Partial<
  Pick<
    Plan,
    | "name"
    | "slug"
    | "description"
    | "pricingMode"
    | "priceCents"
    | "includedUsers"
    | "extraUserPriceCents"
    | "minUsers"
    | "maxUsers"
    | "isActive"
    | "sortOrder"
  >
>

export type Reseller = {
  id: string
  name: string
  slug: string
  contactName?: string
  contactEmail: string
  contactPhone?: string
  commissionRate: number
  status: "active" | "suspended"
  createdAt: string
}

export type ResellerPatch = Partial<
  Pick<
    Reseller,
    | "name"
    | "slug"
    | "contactName"
    | "contactEmail"
    | "contactPhone"
    | "commissionRate"
    | "status"
  >
>

export type ResellerStats = {
  totalTenants: number
  activeTenants: number
  trialTenants: number
  expiredTenants: number
  suspendedTenants: number
  totalUsers: number
  estimatedMonthlyRevenue: number
  commissionRate: number
  estimatedCommission: number
}

/** Fallback seat price used when an organization has no plan assigned. */
export const DEFAULT_SEAT_PRICE_CENTS = 5000

export function computePlanMonthlyCents(
  org: { maxUsers: number },
  plan?: Pick<Plan, "pricingMode" | "priceCents" | "includedUsers" | "extraUserPriceCents"> | null,
): number {
  if (!plan) return org.maxUsers * DEFAULT_SEAT_PRICE_CENTS
  if (plan.pricingMode === "package") {
    const extraSeats = Math.max(0, org.maxUsers - (plan.includedUsers ?? 0))
    return plan.priceCents + extraSeats * (plan.extraUserPriceCents ?? 0)
  }
  return plan.priceCents * org.maxUsers
}

export function isTrialExpired(org: { planType?: string; trialEndsAt?: string | null }): boolean {
  if (org.planType !== "trial" || !org.trialEndsAt) return false
  return new Date(org.trialEndsAt).getTime() < Date.now()
}

export function getTrialDaysRemaining(org: { planType?: string; trialEndsAt?: string | null }): number | null {
  if (org.planType !== "trial" || !org.trialEndsAt) return null
  const diff = new Date(org.trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function getEffectiveOrgStatus(org: Organization): "active" | "trial" | "expired" | "suspended" {
  if (org.status === "suspended") return "suspended"
  if (org.planType === "trial") {
    if (isTrialExpired(org)) return "expired"
    return "trial"
  }
  return "active"
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
    | "isReseller"
    | "resellerID"
    | "canUseAgentUI"
    | "canUseRoutines"
    | "canChangePassword"
    | "auditExempt"
    | "canOpenSettings"
    | "defaultProvider"
    | "defaultModel"
    | "tokenQuota"
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
    | "resellerID"
    | "planType"
    | "trialEndsAt"
    | "planID"
    | "tokenQuota"
    | "userTokenQuota"
    | "tokenQuotaCycleDay"
  >
>

export type TenantStats = {
  totalTenants: number
  activeTenants: number
  trialTenants: number
  expiredTenants: number
  suspendedTenants: number
  totalUsersAcrossTenants: number
  estimatedMonthlyRevenue: number
}

export type Store = {
  ensureSeed(): Promise<void>
  org: {
    get(id?: string): Promise<Organization>
    list(): Promise<Organization[]>
    listByReseller(resellerID: string): Promise<Organization[]>
    findBySlug(slug: string): Promise<Organization | undefined>
    create(input: {
      name: string
      slug: string
      maxUsers?: number
      contactEmail?: string
      logoUrl?: string
      welcomeMessage?: string
      brandColor?: string
      resellerID?: string
      planType?: "trial" | "paid"
      trialDays?: number
      trialEndsAt?: string
      planID?: string
      tokenQuota?: number
      userTokenQuota?: number
      tokenQuotaCycleDay?: number
    }): Promise<Organization>
    update(id: string, patch: OrgPatch): Promise<Organization>
    stats(): Promise<TenantStats>
  }
  plans: {
    list(options?: { activeOnly?: boolean }): Promise<Plan[]>
    findByID(id: string): Promise<Plan | undefined>
    findBySlug(slug: string): Promise<Plan | undefined>
    create(input: PlanInput): Promise<Plan>
    update(id: string, patch: PlanPatch): Promise<Plan | undefined>
    remove(id: string): Promise<void>
  }
  resellers: {
    list(): Promise<Reseller[]>
    findByID(id: string): Promise<Reseller | undefined>
    findBySlug(slug: string): Promise<Reseller | undefined>
    create(input: {
      name: string
      slug: string
      contactName?: string
      contactEmail: string
      contactPhone?: string
      commissionRate?: number
    }): Promise<Reseller>
    update(id: string, patch: ResellerPatch): Promise<Reseller | undefined>
    stats(resellerID: string): Promise<ResellerStats>
  }
  users: {
    list(orgID?: string): Promise<PanelUser[]>
    listByReseller(resellerID: string): Promise<PanelUser[]>
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
      isReseller?: boolean
      resellerID?: string
      canUseAgentUI?: boolean
      canUseRoutines?: boolean
      canChangePassword?: boolean
      auditExempt?: boolean
      canOpenSettings?: boolean
      defaultProvider?: string
      defaultModel?: string
      tokenQuota?: number
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
    listGlobal(): Promise<ProviderDefinition[]>
    findByID(id: string): Promise<ProviderDefinition | undefined>
    findByProviderID(orgID: string, providerID: string): Promise<ProviderDefinition | undefined>
    create(input: {
      orgID: string
      providerID: string
      displayName: string
      scope?: "company" | "global"
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
    getUserKPIs(userID: string, config?: Partial<ReferenceRatesConfig>): Promise<UserKPIs>
    getOrgKPIs(orgID: string, config?: Partial<ReferenceRatesConfig>): Promise<OrgKPIs>
    getUserModelUsage(userID: string, options?: { days?: number }): Promise<ModelUsageSummary[]>
  }
  quota: {
    record(input: {
      sessionID: string
      orgID: string
      userID: string
      tokens: number
      cycleStart: string
    }): Promise<void>
    getUserUsage(userID: string, cycleStart: string): Promise<number>
    getOrgUsage(orgID: string, cycleStart: string): Promise<number>
    getUsageByUser(orgID: string, cycleStart: string): Promise<Record<string, number>>
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
    defaultProvider: undefined,
    defaultModel: undefined,
    providerRestricted: false,
    allowLocalProviders: true,
    planType: "paid",
    trialEndsAt: undefined,
    resellerID: undefined,
    planID: undefined,
    tokenQuota: undefined,
    userTokenQuota: undefined,
    tokenQuotaCycleDay: 1,
    createdAt: new Date().toISOString(),
  }
}

function defaultPlan(): Plan {
  return {
    id: "plan_user_65",
    name: "Licença por Usuário",
    slug: "licenca-por-usuario",
    description: "Cobrança mensal por colaborador ativo.",
    pricingMode: "per_user",
    priceCents: 6500,
    minUsers: 1,
    isActive: true,
    sortOrder: 10,
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
  const resellers = new Map<string, Reseller>()
  const groups = new Map<string, AccessGroup>()
  const members = new Map<string, Set<string>>()
  const providers = new Map<string, ProviderDefinition>()
  const providerGrants = new Map<string, ProviderGrant[]>()
  const sessionRecords: SessionAudit[] = []
  const tokenUsage = new Map<
    string,
    { orgID: string; userID: string; tokens: number; cycleStart: string; updatedAt: string }
  >()
  const credentials = new Map<string, UserProviderCredential>()
  const plans = new Map<string, Plan>()
  const initialOrg = defaultOrg()
  orgs.set(initialOrg.id, initialOrg)
  const seedPlan = defaultPlan()
  plans.set(seedPlan.id, seedPlan)
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
          isReseller: false,
          canUseAgentUI: true,
          canUseRoutines: true,
          canChangePassword: true,
          auditExempt: false,
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
      async listByReseller(resellerID: string) {
        return [...orgs.values()]
          .filter((o) => o.resellerID === resellerID)
          .sort((a, b) => a.name.localeCompare(b.name))
      },
      async findBySlug(slug) {
        return [...orgs.values()].find((o) => o.slug === slug.trim().toLowerCase())
      },
      async create(input) {
        const trialDays = input.trialDays ?? (input.trialEndsAt ? undefined : input.planType === "paid" ? undefined : 14)
        const trialEndsAt = input.trialEndsAt ?? (trialDays ? new Date(Date.now() + trialDays * 86400000).toISOString() : undefined)
        const planType = input.planType ?? (trialEndsAt ? "trial" : "paid")

        const newOrg: Organization = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          status: "active",
          maxUsers: input.maxUsers ?? 10,
          contactEmail: input.contactEmail,
          logoUrl: input.logoUrl,
          welcomeMessage: input.welcomeMessage,
          brandColor: input.brandColor ?? "#10b981",
          ssoMode: "optional",
          offlineGraceHours: 72,
          sessionMaxAgeHours: 12,
          providerRestricted: false,
          allowLocalProviders: true,
          resellerID: input.resellerID,
          planType,
          trialEndsAt,
          planID: input.planID,
          tokenQuota: input.tokenQuota,
          userTokenQuota: input.userTokenQuota,
          tokenQuotaCycleDay: input.tokenQuotaCycleDay ?? 1,
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
        const trialTenants = list.filter((o) => o.planType === "trial" && !isTrialExpired(o) && o.status === "active").length
        const expiredTenants = list.filter((o) => isTrialExpired(o) || o.status === "suspended").length
        const estimatedMonthlyRevenue = list
          .filter((o) => o.status === "active" && o.planType === "paid")
          .reduce((acc, o) => acc + computePlanMonthlyCents(o, o.planID ? plans.get(o.planID) : undefined), 0)
        return {
          totalTenants: list.length,
          activeTenants: list.filter((o) => o.status === "active" && !isTrialExpired(o)).length,
          trialTenants,
          expiredTenants,
          suspendedTenants: list.filter((o) => o.status === "suspended").length,
          totalUsersAcrossTenants: totalUsers,
          estimatedMonthlyRevenue,
        }
      },
    },
    plans: {
      async list(options) {
        const list = [...plans.values()].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        )
        return options?.activeOnly ? list.filter((plan) => plan.isActive) : list
      },
      async findByID(id) {
        return plans.get(id)
      },
      async findBySlug(slug) {
        return [...plans.values()].find((plan) => plan.slug === slug.trim().toLowerCase())
      },
      async create(input) {
        const plan: Plan = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          description: input.description,
          pricingMode: input.pricingMode ?? "per_user",
          priceCents: input.priceCents ?? 0,
          includedUsers: input.includedUsers,
          extraUserPriceCents: input.extraUserPriceCents,
          minUsers: input.minUsers ?? 1,
          maxUsers: input.maxUsers,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0,
          createdAt: new Date().toISOString(),
        }
        plans.set(plan.id, plan)
        return plan
      },
      async update(id, patch) {
        const current = plans.get(id)
        if (!current) return undefined
        Object.assign(current, patch)
        plans.set(id, current)
        return { ...current }
      },
      async remove(id) {
        plans.delete(id)
        for (const org of orgs.values()) {
          if (org.planID === id) org.planID = undefined
        }
      },
    },
    resellers: {
      async list() {
        return [...resellers.values()].sort((a, b) => a.name.localeCompare(b.name))
      },
      async findByID(id) {
        return resellers.get(id)
      },
      async findBySlug(slug) {
        return [...resellers.values()].find((r) => r.slug === slug.trim().toLowerCase())
      },
      async create(input) {
        const reseller: Reseller = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          contactName: input.contactName,
          contactEmail: input.contactEmail.toLowerCase(),
          contactPhone: input.contactPhone,
          commissionRate: input.commissionRate ?? 0.20,
          status: "active",
          createdAt: new Date().toISOString(),
        }
        resellers.set(reseller.id, reseller)
        return reseller
      },
      async update(id, patch) {
        const current = resellers.get(id)
        if (!current) return undefined
        Object.assign(current, patch)
        resellers.set(id, current)
        return { ...current }
      },
      async stats(resellerID: string) {
        const reseller = resellers.get(resellerID)
        const clientOrgs = [...orgs.values()].filter((o) => o.resellerID === resellerID)
        const clientOrgIDs = new Set(clientOrgs.map((o) => o.id))
        const clientUsers = [...users.values()].filter((u) => clientOrgIDs.has(u.orgID) && u.status !== "deleted")
        const totalTenants = clientOrgs.length
        const activeTenants = clientOrgs.filter((o) => o.status === "active" && o.planType === "paid").length
        const trialTenants = clientOrgs.filter((o) => o.planType === "trial" && !isTrialExpired(o) && o.status === "active").length
        const expiredTenants = clientOrgs.filter((o) => isTrialExpired(o) || o.status === "suspended").length
        const suspendedTenants = clientOrgs.filter((o) => o.status === "suspended").length
        const totalUsers = clientUsers.length
        const billableOrgs = clientOrgs.filter((o) => o.status === "active" && o.planType === "paid")
        const estimatedMonthlyRevenue = billableOrgs.reduce(
          (acc, o) => acc + computePlanMonthlyCents(o, o.planID ? plans.get(o.planID) : undefined),
          0,
        )
        const commissionRate = reseller?.commissionRate ?? 0.20
        const estimatedCommission = estimatedMonthlyRevenue * commissionRate
        return {
          totalTenants,
          activeTenants,
          trialTenants,
          expiredTenants,
          suspendedTenants,
          totalUsers,
          estimatedMonthlyRevenue,
          commissionRate,
          estimatedCommission,
        }
      },
    },
    users: {
      async list(orgID) {
        return [...users.values()]
          .filter((user) => user.status !== "deleted" && (!orgID || user.orgID === orgID))
          .sort((left, right) => left.name.localeCompare(right.name))
      },
      async listByReseller(resellerID: string) {
        const clientOrgs = [...orgs.values()].filter((o) => o.resellerID === resellerID)
        const clientOrgIDs = new Set(clientOrgs.map((o) => o.id))
        return [...users.values()]
          .filter((user) => user.status !== "deleted" && clientOrgIDs.has(user.orgID))
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
          isReseller: input.isReseller ?? false,
          resellerID: input.resellerID,
          canUseAgentUI: input.canUseAgentUI ?? true,
          canUseRoutines: input.canUseRoutines ?? true,
          canChangePassword: input.canChangePassword ?? true,
          auditExempt: input.auditExempt ?? false,
          canOpenSettings: input.canOpenSettings ?? true,
          defaultProvider: input.defaultProvider,
          defaultModel: input.defaultModel,
          tokenQuota: input.tokenQuota,
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
        const visible = [...providers.values()].filter(
          (provider) => !orgID || provider.orgID === orgID || provider.scope === "global",
        )
        const byProviderID = new Map<string, ProviderDefinition>()
        for (const provider of visible) {
          const current = byProviderID.get(provider.providerID)
          if (!current || provider.scope === "company") byProviderID.set(provider.providerID, provider)
        }
        return [...byProviderID.values()].sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        )
      },
      async listGlobal() {
        return [...providers.values()]
          .filter((provider) => provider.scope === "global")
          .sort((left, right) => left.displayName.localeCompare(right.displayName))
      },
      async findByID(id) {
        return providers.get(id)
      },
      async findByProviderID(orgID, providerID) {
        const all = [...providers.values()].filter((provider) => provider.providerID === providerID)
        return all.find((provider) => provider.orgID === orgID) ?? all.find((provider) => provider.scope === "global")
      },
      async create(input) {
        const now = new Date().toISOString()
        const provider: ProviderDefinition = {
          id: crypto.randomUUID(),
          orgID: input.orgID,
          providerID: input.providerID,
          displayName: input.displayName,
          scope: input.scope ?? "company",
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
      async getUserKPIs(userID, config) {
        const userSessions = sessionRecords.filter((record) => record.userID === userID)
        const totalSessions = userSessions.length
        const totalTokens = userSessions.reduce((acc, curr) => acc + (curr.tokensTotal || 0), 0)
        const tokensInput = userSessions.reduce((acc, curr) => acc + (curr.tokensInput || 0), 0)
        const tokensOutput = userSessions.reduce((acc, curr) => acc + (curr.tokensOutput || 0), 0)
        const tokensReasoning = userSessions.reduce((acc, curr) => acc + (curr.tokensReasoning || 0), 0)
        const totalCostUsd = userSessions.reduce((acc, curr) => acc + (curr.costUsd || 0), 0)
        const totalDurationMs = userSessions.reduce((acc, curr) => acc + (curr.durationMs || 0), 0)
        const savings = computeComparativeSavings(
          { total: totalTokens, input: tokensInput, output: tokensOutput, reasoning: tokensReasoning },
          totalCostUsd,
          config,
        )
        return {
          totalSessions,
          totalTokens,
          tokensInput,
          tokensOutput,
          tokensReasoning,
          totalCostUsd: Number(totalCostUsd.toFixed(4)),
          totalDurationMs,
          referenceCostAnthropic: savings.referenceCostAnthropic,
          referenceCostOpenAI: savings.referenceCostOpenAI,
          referenceMarketCost: savings.referenceMarketCost,
          savingsUsd: savings.savingsUsd,
          savingsPercentage: savings.savingsPercentage,
        }
      },
      async getOrgKPIs(orgID, config) {
        const orgSessions = sessionRecords.filter((record) => record.orgID === orgID)
        const totalSessions = orgSessions.length
        const totalTokens = orgSessions.reduce((acc, curr) => acc + (curr.tokensTotal || 0), 0)
        const tokensInput = orgSessions.reduce((acc, curr) => acc + (curr.tokensInput || 0), 0)
        const tokensOutput = orgSessions.reduce((acc, curr) => acc + (curr.tokensOutput || 0), 0)
        const tokensReasoning = orgSessions.reduce((acc, curr) => acc + (curr.tokensReasoning || 0), 0)
        const totalCostUsd = orgSessions.reduce((acc, curr) => acc + (curr.costUsd || 0), 0)
        const totalDurationMs = orgSessions.reduce((acc, curr) => acc + (curr.durationMs || 0), 0)
        const savings = computeComparativeSavings(
          { total: totalTokens, input: tokensInput, output: tokensOutput, reasoning: tokensReasoning },
          totalCostUsd,
          config,
        )
        return {
          totalSessions,
          totalTokens,
          tokensInput,
          tokensOutput,
          tokensReasoning,
          totalCostUsd: Number(totalCostUsd.toFixed(4)),
          totalDurationMs,
          referenceCostAnthropic: savings.referenceCostAnthropic,
          referenceCostOpenAI: savings.referenceCostOpenAI,
          referenceMarketCost: savings.referenceMarketCost,
          savingsUsd: savings.savingsUsd,
          savingsPercentage: savings.savingsPercentage,
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
    quota: {
      async record(input) {
        const existing = tokenUsage.get(input.sessionID)
        tokenUsage.set(input.sessionID, {
          orgID: input.orgID,
          userID: input.userID,
          tokens: Math.max(0, Math.trunc(input.tokens)),
          cycleStart: existing?.cycleStart ?? input.cycleStart,
          updatedAt: new Date().toISOString(),
        })
      },
      async getUserUsage(userID, cycleStart) {
        let total = 0
        for (const entry of tokenUsage.values()) {
          if (entry.userID === userID && entry.cycleStart === cycleStart) total += entry.tokens
        }
        return total
      },
      async getOrgUsage(orgID, cycleStart) {
        let total = 0
        for (const entry of tokenUsage.values()) {
          if (entry.orgID === orgID && entry.cycleStart === cycleStart) total += entry.tokens
        }
        return total
      },
      async getUsageByUser(orgID, cycleStart) {
        const usage: Record<string, number> = {}
        for (const entry of tokenUsage.values()) {
          if (entry.orgID !== orgID || entry.cycleStart !== cycleStart) continue
          usage[entry.userID] = (usage[entry.userID] ?? 0) + entry.tokens
        }
        return usage
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
  is_reseller?: number
  reseller_id?: string | null
  can_use_agentui?: number
  can_use_routines?: number
  can_change_password?: number
  audit_exempt?: number
  can_open_settings?: number | null
  default_provider?: string | null
  default_model?: string | null
  token_quota?: number | null
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
  reseller_id?: string | null
  plan_type?: string | null
  trial_ends_at?: string | null
  plan_id?: string | null
  token_quota?: number | null
  user_token_quota?: number | null
  token_quota_cycle_day?: number | null
  created_at: string
}

type PlanRow = {
  id: string
  name: string
  slug: string
  description: string | null
  pricing_mode: string
  price_cents: number
  included_users: number | null
  extra_user_price_cents: number | null
  min_users: number
  max_users: number | null
  is_active: number
  sort_order: number
  created_at: string
}

type ResellerRow = {
  id: string
  name: string
  slug: string
  contact_name: string | null
  contact_email: string
  contact_phone: string | null
  commission_rate: number
  status: string
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
  scope?: string | null
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
    isReseller: row.is_reseller === 1,
    resellerID: row.reseller_id ?? undefined,
    canUseAgentUI: row.can_use_agentui !== 0,
    canUseRoutines: row.can_use_routines !== 0,
    canChangePassword: row.can_change_password !== 0,
    auditExempt: row.audit_exempt === 1,
    canOpenSettings:
      row.can_open_settings === null || row.can_open_settings === undefined
        ? undefined
        : row.can_open_settings !== 0,
    defaultProvider: row.default_provider ?? undefined,
    defaultModel: row.default_model ?? undefined,
    tokenQuota: row.token_quota ?? undefined,
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
    resellerID: row.reseller_id ?? undefined,
    planType: row.plan_type === "paid" ? "paid" : "trial",
    trialEndsAt: row.trial_ends_at ?? undefined,
    planID: row.plan_id ?? undefined,
    tokenQuota: row.token_quota ?? undefined,
    userTokenQuota: row.user_token_quota ?? undefined,
    tokenQuotaCycleDay: row.token_quota_cycle_day ?? 1,
    createdAt: row.created_at,
  }
}

function toPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? undefined,
    pricingMode: row.pricing_mode === "package" ? "package" : "per_user",
    priceCents: row.price_cents ?? 0,
    includedUsers: row.included_users ?? undefined,
    extraUserPriceCents: row.extra_user_price_cents ?? undefined,
    minUsers: row.min_users ?? 1,
    maxUsers: row.max_users ?? undefined,
    isActive: row.is_active !== 0,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  }
}

function toReseller(row: ResellerRow): Reseller {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    contactName: row.contact_name ?? undefined,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone ?? undefined,
    commissionRate: row.commission_rate ?? 0.20,
    status: row.status === "suspended" ? "suspended" : "active",
    createdAt: row.created_at,
  }
}

function toProvider(row: ProviderRow): ProviderDefinition {
  return {
    id: row.id,
    orgID: row.org_id,
    providerID: row.provider_id,
    displayName: row.display_name,
    scope: row.scope === "global" ? "global" : "company",
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

  const planFindByID = async (id: string) => {
    const row = await db.prepare("SELECT * FROM plan WHERE id = ?").bind(id).first<PlanRow>()
    return row ? toPlan(row) : undefined
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
      async listByReseller(resellerID: string) {
        const rows = await db
          .prepare("SELECT * FROM organization WHERE reseller_id = ? ORDER BY name ASC")
          .bind(resellerID)
          .all<OrgRow>()
        return rows.results.map(toOrg)
      },
      async findBySlug(slug: string) {
        const row = await db.prepare("SELECT * FROM organization WHERE slug = ?").bind(slug.trim().toLowerCase()).first<OrgRow>()
        return row ? toOrg(row) : undefined
      },
      async create(input) {
        const trialDays = input.trialDays ?? (input.trialEndsAt ? undefined : input.planType === "paid" ? undefined : 14)
        const trialEndsAt = input.trialEndsAt ?? (trialDays ? new Date(Date.now() + trialDays * 86400000).toISOString() : undefined)
        const planType = input.planType ?? (trialEndsAt ? "trial" : "paid")

        const newOrg: Organization = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          status: "active",
          maxUsers: input.maxUsers ?? 10,
          contactEmail: input.contactEmail,
          logoUrl: input.logoUrl,
          welcomeMessage: input.welcomeMessage,
          brandColor: input.brandColor ?? "#10b981",
          ssoMode: "optional",
          offlineGraceHours: 72,
          sessionMaxAgeHours: 12,
          providerRestricted: false,
          allowLocalProviders: true,
          resellerID: input.resellerID,
          planType,
          trialEndsAt,
          planID: input.planID,
          tokenQuota: input.tokenQuota,
          userTokenQuota: input.userTokenQuota,
          tokenQuotaCycleDay: input.tokenQuotaCycleDay ?? 1,
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO organization (id, name, slug, status, max_users, contact_email, logo_url, welcome_message, brand_color, sso_mode, offline_grace_hours, session_max_age_hours, reseller_id, plan_type, trial_ends_at, plan_id, token_quota, user_token_quota, token_quota_cycle_day, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            newOrg.id,
            newOrg.name,
            newOrg.slug,
            newOrg.status,
            newOrg.maxUsers,
            newOrg.contactEmail ?? null,
            newOrg.logoUrl ?? null,
            newOrg.welcomeMessage ?? null,
            newOrg.brandColor ?? null,
            newOrg.ssoMode,
            newOrg.offlineGraceHours,
            newOrg.sessionMaxAgeHours,
            newOrg.resellerID ?? null,
            newOrg.planType,
            newOrg.trialEndsAt ?? null,
            newOrg.planID ?? null,
            newOrg.tokenQuota ?? null,
            newOrg.userTokenQuota ?? null,
            newOrg.tokenQuotaCycleDay,
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
            `UPDATE organization SET name = ?, slug = ?, status = ?, max_users = ?, contact_email = ?, logo_url = ?, welcome_message = ?, brand_color = ?, sso_mode = ?, offline_grace_hours = ?, session_max_age_hours = ?, default_provider = ?, default_model = ?, provider_policy = ?, allow_local_providers = ?, reseller_id = ?, plan_type = ?, trial_ends_at = ?, plan_id = ?, token_quota = ?, user_token_quota = ?, token_quota_cycle_day = ? WHERE id = ?`,
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
            next.resellerID ?? null,
            next.planType,
            next.trialEndsAt ?? null,
            next.planID ?? null,
            next.tokenQuota ?? null,
            next.userTokenQuota ?? null,
            next.tokenQuotaCycleDay ?? 1,
            id,
          )
          .run()
        return next
      },
      async stats() {
        const rows = await db.prepare("SELECT * FROM organization").all<OrgRow>()
        const list = rows.results.map(toOrg)
        const planRows = await db.prepare("SELECT * FROM plan").all<PlanRow>()
        const planByID = new Map(planRows.results.map((row) => [row.id, toPlan(row)]))
        const userCount = await db
          .prepare("SELECT COUNT(*) as total FROM panel_user WHERE status != 'deleted'")
          .first<{ total: number }>()

        const totalTenants = list.length
        const activeTenants = list.filter((o) => o.status === "active" && o.planType === "paid").length
        const trialTenants = list.filter((o) => o.planType === "trial" && !isTrialExpired(o) && o.status === "active").length
        const expiredTenants = list.filter((o) => isTrialExpired(o) || o.status === "suspended").length
        const suspendedTenants = list.filter((o) => o.status === "suspended").length
        const estimatedMonthlyRevenue = list
          .filter((o) => o.status === "active" && o.planType === "paid")
          .reduce((acc, o) => acc + computePlanMonthlyCents(o, o.planID ? planByID.get(o.planID) : undefined), 0)

        return {
          totalTenants,
          activeTenants,
          trialTenants,
          expiredTenants,
          suspendedTenants,
          totalUsersAcrossTenants: Number(userCount?.total ?? 0),
          estimatedMonthlyRevenue,
        }
      },
    },
    plans: {
      async list(options) {
        const rows = options?.activeOnly
          ? await db.prepare("SELECT * FROM plan WHERE is_active = 1 ORDER BY sort_order ASC, name ASC").all<PlanRow>()
          : await db.prepare("SELECT * FROM plan ORDER BY sort_order ASC, name ASC").all<PlanRow>()
        return rows.results.map(toPlan)
      },
      async findByID(id) {
        const row = await db.prepare("SELECT * FROM plan WHERE id = ?").bind(id).first<PlanRow>()
        return row ? toPlan(row) : undefined
      },
      async findBySlug(slug) {
        const row = await db.prepare("SELECT * FROM plan WHERE slug = ?").bind(slug.trim().toLowerCase()).first<PlanRow>()
        return row ? toPlan(row) : undefined
      },
      async create(input) {
        const plan: Plan = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          description: input.description,
          pricingMode: input.pricingMode ?? "per_user",
          priceCents: input.priceCents ?? 0,
          includedUsers: input.includedUsers,
          extraUserPriceCents: input.extraUserPriceCents,
          minUsers: input.minUsers ?? 1,
          maxUsers: input.maxUsers,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0,
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO plan (id, name, slug, description, pricing_mode, price_cents, included_users, extra_user_price_cents, min_users, max_users, is_active, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            plan.id,
            plan.name,
            plan.slug,
            plan.description ?? null,
            plan.pricingMode,
            plan.priceCents,
            plan.includedUsers ?? null,
            plan.extraUserPriceCents ?? null,
            plan.minUsers,
            plan.maxUsers ?? null,
            plan.isActive ? 1 : 0,
            plan.sortOrder,
            plan.createdAt,
          )
          .run()
        return plan
      },
      async update(id, patch) {
        const current = await planFindByID(id)
        if (!current) return undefined
        const next = { ...current, ...patch }
        await db
          .prepare(
            `UPDATE plan SET name = ?, slug = ?, description = ?, pricing_mode = ?, price_cents = ?, included_users = ?, extra_user_price_cents = ?, min_users = ?, max_users = ?, is_active = ?, sort_order = ? WHERE id = ?`,
          )
          .bind(
            next.name,
            next.slug,
            next.description ?? null,
            next.pricingMode,
            next.priceCents,
            next.includedUsers ?? null,
            next.extraUserPriceCents ?? null,
            next.minUsers,
            next.maxUsers ?? null,
            next.isActive ? 1 : 0,
            next.sortOrder,
            id,
          )
          .run()
        return next
      },
      async remove(id) {
        await db.prepare("UPDATE organization SET plan_id = NULL WHERE plan_id = ?").bind(id).run()
        await db.prepare("DELETE FROM plan WHERE id = ?").bind(id).run()
      },
    },
    resellers: {
      async list() {
        const rows = await db.prepare("SELECT * FROM reseller ORDER BY name ASC").all<ResellerRow>()
        return rows.results.map(toReseller)
      },
      async findByID(id) {
        const row = await db.prepare("SELECT * FROM reseller WHERE id = ?").bind(id).first<ResellerRow>()
        return row ? toReseller(row) : undefined
      },
      async findBySlug(slug) {
        const row = await db.prepare("SELECT * FROM reseller WHERE slug = ?").bind(slug.trim().toLowerCase()).first<ResellerRow>()
        return row ? toReseller(row) : undefined
      },
      async create(input) {
        const reseller: Reseller = {
          id: crypto.randomUUID(),
          name: input.name,
          slug: input.slug.trim().toLowerCase(),
          contactName: input.contactName,
          contactEmail: input.contactEmail.toLowerCase(),
          contactPhone: input.contactPhone,
          commissionRate: input.commissionRate ?? 0.20,
          status: "active",
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO reseller (id, name, slug, contact_name, contact_email, contact_phone, commission_rate, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            reseller.id,
            reseller.name,
            reseller.slug,
            reseller.contactName ?? null,
            reseller.contactEmail,
            reseller.contactPhone ?? null,
            reseller.commissionRate,
            reseller.status,
            reseller.createdAt,
          )
          .run()
        return reseller
      },
      async update(id, patch) {
        const current = await db.prepare("SELECT * FROM reseller WHERE id = ?").bind(id).first<ResellerRow>()
        if (!current) return undefined
        const res = toReseller(current)
        const next = { ...res, ...patch }
        await db
          .prepare(
            `UPDATE reseller SET name = ?, slug = ?, contact_name = ?, contact_email = ?, contact_phone = ?, commission_rate = ?, status = ? WHERE id = ?`,
          )
          .bind(
            next.name,
            next.slug,
            next.contactName ?? null,
            next.contactEmail,
            next.contactPhone ?? null,
            next.commissionRate,
            next.status,
            id,
          )
          .run()
        return next
      },
      async stats(resellerID: string) {
        const resRow = await db.prepare("SELECT * FROM reseller WHERE id = ?").bind(resellerID).first<ResellerRow>()
        const reseller = resRow ? toReseller(resRow) : undefined
        const orgRows = await db.prepare("SELECT * FROM organization WHERE reseller_id = ?").bind(resellerID).all<OrgRow>()
        const clientOrgs = orgRows.results.map(toOrg)
        const clientOrgIDs = new Set(clientOrgs.map((o) => o.id))
        const userRows = await db.prepare("SELECT org_id FROM panel_user WHERE status != 'deleted'").all<{ org_id: string }>()
        const clientUsersCount = userRows.results.filter((u) => clientOrgIDs.has(u.org_id)).length

        const totalTenants = clientOrgs.length
        const activeTenants = clientOrgs.filter((o) => o.status === "active" && o.planType === "paid").length
        const trialTenants = clientOrgs.filter((o) => o.planType === "trial" && !isTrialExpired(o) && o.status === "active").length
        const expiredTenants = clientOrgs.filter((o) => isTrialExpired(o) || o.status === "suspended").length
        const suspendedTenants = clientOrgs.filter((o) => o.status === "suspended").length
        const totalUsers = clientUsersCount
        const planRows = await db.prepare("SELECT * FROM plan").all<PlanRow>()
        const planByID = new Map(planRows.results.map((row) => [row.id, toPlan(row)]))
        const estimatedMonthlyRevenue = clientOrgs
          .filter((o) => o.status === "active" && o.planType === "paid")
          .reduce((acc, o) => acc + computePlanMonthlyCents(o, o.planID ? planByID.get(o.planID) : undefined), 0)
        const commissionRate = reseller?.commissionRate ?? 0.20
        const estimatedCommission = estimatedMonthlyRevenue * commissionRate
        return {
          totalTenants,
          activeTenants,
          trialTenants,
          expiredTenants,
          suspendedTenants,
          totalUsers,
          estimatedMonthlyRevenue,
          commissionRate,
          estimatedCommission,
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
      async listByReseller(resellerID: string) {
        const orgRows = await db
          .prepare("SELECT id FROM organization WHERE reseller_id = ?")
          .bind(resellerID)
          .all<{ id: string }>()
        const orgIDs = new Set(orgRows.results.map((o) => o.id))
        const rows = await db.prepare("SELECT * FROM panel_user WHERE status != 'deleted' ORDER BY name ASC").all<UserRow>()
        return rows.results.filter((u) => orgIDs.has(u.org_id)).map(toUser)
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
          isReseller: input.isReseller ?? false,
          resellerID: input.resellerID,
          canUseAgentUI: input.canUseAgentUI ?? true,
          canUseRoutines: input.canUseRoutines ?? true,
          canChangePassword: input.canChangePassword ?? true,
          auditExempt: input.auditExempt ?? false,
          canOpenSettings: input.canOpenSettings ?? true,
          defaultProvider: input.defaultProvider,
          defaultModel: input.defaultModel,
          tokenQuota: input.tokenQuota,
          accessOverrides: JSON.stringify(input.accessOverrides ?? {}),
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO panel_user (id, org_id, name, email, role, status, password_hash, must_change_password, is_platform_admin, is_reseller, reseller_id, can_use_agentui, can_use_routines, can_change_password, audit_exempt, can_open_settings, default_provider, default_model, token_quota, access_overrides, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            user.isReseller ? 1 : 0,
            user.resellerID ?? null,
            user.canUseAgentUI ? 1 : 0,
            user.canUseRoutines ? 1 : 0,
            user.canChangePassword ? 1 : 0,
            user.auditExempt ? 1 : 0,
            user.canOpenSettings === undefined ? null : user.canOpenSettings ? 1 : 0,
            user.defaultProvider ?? null,
            user.defaultModel ?? null,
            user.tokenQuota ?? null,
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
            `UPDATE panel_user SET name = ?, email = ?, role = ?, status = ?, password_hash = ?, must_change_password = ?, last_login_at = ?, can_use_agentui = ?, can_use_routines = ?, can_change_password = ?, audit_exempt = ?, can_open_settings = ?, default_provider = ?, default_model = ?, token_quota = ?, access_overrides = ?, app_version = ?, app_version_at = ?, is_reseller = ?, reseller_id = ? WHERE id = ?`,
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
            next.auditExempt ? 1 : 0,
            next.canOpenSettings === undefined ? null : next.canOpenSettings ? 1 : 0,
            next.defaultProvider ?? null,
            next.defaultModel ?? null,
            next.tokenQuota ?? null,
            next.accessOverrides ?? "{}",
            next.appVersion ?? null,
            next.appVersionAt ?? null,
            next.isReseller ? 1 : 0,
            next.resellerID ?? null,
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
          ? db
              .prepare(
                "SELECT * FROM provider_definition WHERE org_id = ? OR scope = 'global' ORDER BY display_name ASC",
              )
              .bind(orgID)
          : db.prepare("SELECT * FROM provider_definition ORDER BY display_name ASC")
        const rows = await query.all<ProviderRow>()
        const byProviderID = new Map<string, ProviderDefinition>()
        for (const provider of rows.results.map(toProvider)) {
          const current = byProviderID.get(provider.providerID)
          if (!current || provider.scope === "company") byProviderID.set(provider.providerID, provider)
        }
        return [...byProviderID.values()].sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        )
      },
      async listGlobal() {
        const rows = await db
          .prepare("SELECT * FROM provider_definition WHERE scope = 'global' ORDER BY display_name ASC")
          .all<ProviderRow>()
        return rows.results.map(toProvider)
      },
      async findByID(id) {
        const row = await db.prepare("SELECT * FROM provider_definition WHERE id = ?").bind(id).first<ProviderRow>()
        return row ? toProvider(row) : undefined
      },
      async findByProviderID(orgID, providerID) {
        const row = await db
          .prepare(
            "SELECT * FROM provider_definition WHERE provider_id = ? AND (org_id = ? OR scope = 'global') ORDER BY CASE WHEN scope = 'global' THEN 1 ELSE 0 END LIMIT 1",
          )
          .bind(providerID, orgID)
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
          scope: input.scope ?? "company",
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
            `INSERT INTO provider_definition (id, org_id, provider_id, display_name, scope, kind, protocol, npm, base_url, api_key, models_json, headers_json, env_json, enabled, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            provider.id,
            provider.orgID,
            provider.providerID,
            provider.displayName,
            provider.scope,
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
        const row = await db
          .prepare("SELECT org_id, provider_id, scope FROM provider_definition WHERE id = ?")
          .bind(id)
          .first<{ org_id: string; provider_id: string; scope: string }>()
        await db.prepare("DELETE FROM provider_definition WHERE id = ?").bind(id).run()
        if (!row) return
        if (row.scope === "global") {
          await db.prepare("DELETE FROM provider_grant WHERE provider_id = ?").bind(row.provider_id).run()
          return
        }
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
        const row = await db
          .prepare("SELECT * FROM session_audit WHERE session_id = ?")
          .bind(item.sessionID)
          .first<SessionAuditRow>()
        return row ? toSessionAudit(row) : item
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
      async getUserKPIs(userID, config) {
        const row = await db
          .prepare(
            `SELECT
               COUNT(*) AS total_sessions,
               SUM(tokens_total) AS total_tokens,
               SUM(tokens_input) AS total_tokens_input,
               SUM(tokens_output) AS total_tokens_output,
               SUM(tokens_reasoning) AS total_tokens_reasoning,
               SUM(cost_usd) AS total_cost_usd,
               SUM(duration_ms) AS total_duration_ms
             FROM session_audit WHERE user_id = ?`,
          )
          .bind(userID)
          .first<{
            total_sessions: number
            total_tokens: number
            total_tokens_input: number
            total_tokens_output: number
            total_tokens_reasoning: number
            total_cost_usd: number
            total_duration_ms: number
          }>()

        const totalSessions = Number(row?.total_sessions ?? 0)
        const totalTokens = Number(row?.total_tokens ?? 0)
        const tokensInput = Number(row?.total_tokens_input ?? 0)
        const tokensOutput = Number(row?.total_tokens_output ?? 0)
        const tokensReasoning = Number(row?.total_tokens_reasoning ?? 0)
        const totalCostUsd = Number(row?.total_cost_usd ?? 0)
        const totalDurationMs = Number(row?.total_duration_ms ?? 0)

        const savings = computeComparativeSavings(
          { total: totalTokens, input: tokensInput, output: tokensOutput, reasoning: tokensReasoning },
          totalCostUsd,
          config,
        )

        return {
          totalSessions,
          totalTokens,
          tokensInput,
          tokensOutput,
          tokensReasoning,
          totalCostUsd: Number(totalCostUsd.toFixed(4)),
          totalDurationMs,
          referenceCostAnthropic: savings.referenceCostAnthropic,
          referenceCostOpenAI: savings.referenceCostOpenAI,
          referenceMarketCost: savings.referenceMarketCost,
          savingsUsd: savings.savingsUsd,
          savingsPercentage: savings.savingsPercentage,
        }
      },
      async getOrgKPIs(orgID, config) {
        const row = await db
          .prepare(
            `SELECT
               COUNT(*) AS total_sessions,
               SUM(tokens_total) AS total_tokens,
               SUM(tokens_input) AS total_tokens_input,
               SUM(tokens_output) AS total_tokens_output,
               SUM(tokens_reasoning) AS total_tokens_reasoning,
               SUM(cost_usd) AS total_cost_usd,
               SUM(duration_ms) AS total_duration_ms
             FROM session_audit WHERE org_id = ?`,
          )
          .bind(orgID)
          .first<{
            total_sessions: number
            total_tokens: number
            total_tokens_input: number
            total_tokens_output: number
            total_tokens_reasoning: number
            total_cost_usd: number
            total_duration_ms: number
          }>()

        const totalSessions = Number(row?.total_sessions ?? 0)
        const totalTokens = Number(row?.total_tokens ?? 0)
        const tokensInput = Number(row?.total_tokens_input ?? 0)
        const tokensOutput = Number(row?.total_tokens_output ?? 0)
        const tokensReasoning = Number(row?.total_tokens_reasoning ?? 0)
        const totalCostUsd = Number(row?.total_cost_usd ?? 0)
        const totalDurationMs = Number(row?.total_duration_ms ?? 0)

        const savings = computeComparativeSavings(
          { total: totalTokens, input: tokensInput, output: tokensOutput, reasoning: tokensReasoning },
          totalCostUsd,
          config,
        )

        return {
          totalSessions,
          totalTokens,
          tokensInput,
          tokensOutput,
          tokensReasoning,
          totalCostUsd: Number(totalCostUsd.toFixed(4)),
          totalDurationMs,
          referenceCostAnthropic: savings.referenceCostAnthropic,
          referenceCostOpenAI: savings.referenceCostOpenAI,
          referenceMarketCost: savings.referenceMarketCost,
          savingsUsd: savings.savingsUsd,
          savingsPercentage: savings.savingsPercentage,
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
    quota: {
      async record(input) {
        const now = new Date().toISOString()
        await db
          .prepare(
            `INSERT INTO token_usage_ledger (session_id, org_id, user_id, tokens, cycle_start, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(session_id) DO UPDATE SET
               tokens = excluded.tokens,
               updated_at = excluded.updated_at`,
          )
          .bind(
            input.sessionID,
            input.orgID,
            input.userID,
            Math.max(0, Math.trunc(input.tokens)),
            input.cycleStart,
            now,
          )
          .run()
      },
      async getUserUsage(userID, cycleStart) {
        const row = await db
          .prepare(
            "SELECT COALESCE(SUM(tokens), 0) AS total FROM token_usage_ledger WHERE user_id = ? AND cycle_start = ?",
          )
          .bind(userID, cycleStart)
          .first<{ total: number }>()
        return Number(row?.total ?? 0)
      },
      async getOrgUsage(orgID, cycleStart) {
        const row = await db
          .prepare(
            "SELECT COALESCE(SUM(tokens), 0) AS total FROM token_usage_ledger WHERE org_id = ? AND cycle_start = ?",
          )
          .bind(orgID, cycleStart)
          .first<{ total: number }>()
        return Number(row?.total ?? 0)
      },
      async getUsageByUser(orgID, cycleStart) {
        const rows = await db
          .prepare(
            "SELECT user_id, COALESCE(SUM(tokens), 0) AS total FROM token_usage_ledger WHERE org_id = ? AND cycle_start = ? GROUP BY user_id",
          )
          .bind(orgID, cycleStart)
          .all<{ user_id: string; total: number }>()
        const usage: Record<string, number> = {}
        for (const row of rows.results) usage[row.user_id] = Number(row.total ?? 0)
        return usage
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
