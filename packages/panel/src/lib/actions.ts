import { action, query, redirect } from "@solidjs/router"
import { auditDb } from "./audit-db"
import { canAccessPortal, canManageOrganization, canManageUsers, canRemoveUsers, currentUser, requirePlatformAdmin, requireReseller, requireUser } from "./auth"
import { generatePassword, hashPassword, passwordHashIsSupported, verifyPassword } from "./crypto"
import { parseOverrides, RESOURCES, isProviderAllowed, type AccessOverrides, type ProviderEffect } from "./access"
import {
  CUSTOM_PROVIDER_NPM,
  isHttpUrl,
  sanitizeEnv,
  sanitizeHeaders,
  sanitizeModels,
  validProviderID,
} from "./providers"
import { usePanelSession } from "./session"
import { store, isTrialExpired, DEFAULT_ORG_ID, EMPTY_USER_KPIS, type PanelUser, type ProviderDefinition, type ProviderProtocol, type Role } from "./store"
import { resolveUserAccess } from "./user-access"
import type { ReferenceRatesConfig } from "./kpi-pricing"
import { normalizeCycleDay, parseTokenAmount } from "./quota"
import { fetchProviderModels } from "./provider-fetch"
import { loadQuotaOverview, loadQuotaState } from "./quota-service"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CREATABLE_ROLES: Role[] = ["admin", "member"]

/** Accepts "65", "65,00", "65.00" and "1.234,56" and returns cents. */
export function parseCurrencyToCents(input: unknown): number {
  const raw = String(input ?? "").trim().replace(/[R$\s]/g, "")
  if (!raw) return 0
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100)
}

type SeatLimits = { minUsers?: number; maxUsers?: number }

/** Validates a seat count against the assigned plan bounds. */
export function seatLimitError(plan: SeatLimits | null | undefined, seats: number) {
  if (!plan) return undefined
  const min = plan.minUsers ?? 1
  if (seats < min) return { error: "admin.plans.error.belowMinUsers" as const, min }
  if (plan.maxUsers && seats > plan.maxUsers) {
    return { error: "admin.plans.error.aboveMaxUsers" as const, max: plan.maxUsers }
  }
  return undefined
}

/** Reads the tri-state access matrix rendered by the portal forms. */
export function accessFromForm(form: FormData): AccessOverrides {
  const overrides: AccessOverrides = {}
  for (const resource of RESOURCES) {
    const value = String(form.get(`access.${resource}`) ?? "inherit")
    if (value === "allow") overrides[resource] = true
    if (value === "deny") overrides[resource] = false
  }
  return overrides
}

function settingsFlag(form: FormData, name: string): boolean | undefined {
  const value = String(form.get(name) ?? "inherit")
  if (value === "allow") return true
  if (value === "deny") return false
  return undefined
}

function publicUser(user: PanelUser) {
  return {
    id: user.id,
    orgID: user.orgID,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    isPlatformAdmin: user.isPlatformAdmin,
    isReseller: user.isReseller ?? false,
    resellerID: user.resellerID,
    canUseAgentUI: user.canUseAgentUI,
    canUseRoutines: user.canUseRoutines,
    canChangePassword: user.canChangePassword,
    auditExempt: Boolean(user.auditExempt),
    canOpenSettings: user.canOpenSettings,
    defaultProvider: user.defaultProvider,
    defaultModel: user.defaultModel,
    tokenQuota: user.tokenQuota,
    access: parseOverrides(user.accessOverrides),
    appVersion: user.appVersion,
    appVersionAt: user.appVersionAt,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

export type PublicUser = ReturnType<typeof publicUser>

export type UserDetail = PublicUser & { groupIDs: string[] }

export const me = query(async () => {
  "use server"
  const user = await currentUser()
  return user ? publicUser(user) : null
}, "panel.me")

export const requireMe = query(async () => {
  "use server"
  const user = await requireUser()
  return publicUser(user)
}, "panel.me.required")

export const listUsers = query(async () => {
  "use server"
  const actor = await requireUser()
  const db = store()
  await db.ensureSeed()
  return (await db.users.list(actor.orgID)).map(publicUser)
}, "panel.users")

export const getUser = query(async (id: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const user = await db.users.findByID(id)
  if (!user || user.orgID !== actor.orgID) return null
  const groups = await db.groups.groupsForUser(user.id)
  return { ...publicUser(user), groupIDs: groups.map((group) => group.id) }
}, "panel.user")

export const getUserSessions = query(async (id: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const user = await db.users.findByID(id)
  if (!user || user.orgID !== actor.orgID) return []
  return db.sessions.listByUser(id)
}, "panel.user.sessions")

export const getUserKPIs = query(async (id: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const user = await db.users.findByID(id)
  if (!user || user.orgID !== actor.orgID) return EMPTY_USER_KPIS
  return db.sessions.getUserKPIs(id)
}, "panel.user.kpis")

export const getOrgSessions = query(
  async (options: { userID?: string; search?: string; limit?: number; offset?: number } = {}) => {
    "use server"
    const actor = await requireUser()
    const pgSessions = await auditDb.sessions.listByOrg(actor.orgID, options)
    if (pgSessions) return pgSessions

    const db = store()
    return db.sessions.listByOrg(actor.orgID, options)
  },
  "panel.org.sessions",
)

export const getOrgKPIs = query(async (config?: Partial<ReferenceRatesConfig>) => {
  "use server"
  const actor = await requireUser()
  const pgKpis = await auditDb.sessions.getOrgKPIs(actor.orgID)
  if (pgKpis) return pgKpis

  const db = store()
  return db.sessions.getOrgKPIs(actor.orgID, config)
}, "panel.org.kpis")

export const getUserModelUsage = query(async (id: string, days?: number) => {
  "use server"
  const actor = await requireUser()
  const pgUsage = await auditDb.sessions.getUserModelUsage(id, { days })
  if (pgUsage) return pgUsage

  const db = store()
  const user = await db.users.findByID(id)
  if (!user || user.orgID !== actor.orgID) return []
  return db.sessions.getUserModelUsage(id, { days })
}, "panel.user.models")

export const getSessionAudit = query(async (sessionID: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const session = await db.sessions.findBySessionID(sessionID)
  if (!session || session.orgID !== actor.orgID) return null
  const user = await db.users.findByID(session.userID)
  return {
    session,
    owner: user ? { id: user.id, name: user.name, email: user.email } : null,
  }
}, "panel.session")

export const listAudit = query(async (targetID?: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  return targetID ? db.audit.forTarget(targetID) : db.audit.list(actor.orgID)
}, "panel.audit")

export const getStats = query(async () => {
  "use server"
  const actor = await requireUser()
  const db = store()
  await db.ensureSeed()
  return db.users.count(actor.orgID)
}, "panel.stats")

export const getSettings = query(async () => {
  "use server"
  const actor = await requireUser()
  const db = store()
  await db.ensureSeed()
  return db.org.get(actor.orgID)
}, "panel.settings")

export const getCurrentOrg = query(async () => {
  "use server"
  const actor = await requireUser()
  const db = store()
  await db.ensureSeed()
  const org = await db.org.get(actor.orgID)
  if (!org) return null
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    welcomeMessage: org.welcomeMessage,
    brandColor: org.brandColor,
    planType: org.planType,
    trialEndsAt: org.trialEndsAt,
    tokenQuota: org.tokenQuota,
    userTokenQuota: org.userTokenQuota,
    tokenQuotaCycleDay: org.tokenQuotaCycleDay,
  }
}, "panel.currentOrg")

export const getOrgQuota = query(async () => {
  "use server"
  const actor = await requireUser()
  return loadQuotaState(actor.orgID)
}, "panel.quota.org")

export const getQuotaOverview = query(async () => {
  "use server"
  const actor = await requireUser()
  return loadQuotaOverview(actor.orgID)
}, "panel.quota.overview")

export const getUserQuota = query(async (id: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const user = await db.users.findByID(id)
  if (!user || user.orgID !== actor.orgID) return null
  return loadQuotaState(actor.orgID, user.id)
}, "panel.quota.user")

export const updateOrgQuota = action(
  async (input: { quota: string; cycleDay: number }) => {
    "use server"
    const actor = await requireUser()
    if (!canManageUsers(actor)) return { error: "settings.ownerOnly" as const }

    const raw = input.quota.trim()
    const quota = raw ? parseTokenAmount(raw) : null
    if (raw && quota === null) return { error: "quota.error.invalidAmount" as const }

    const db = store()
    const org = await db.org.get(actor.orgID)
    if (quota !== null && org.tokenQuota !== undefined && quota > org.tokenQuota) {
      return { error: "quota.error.globalExceedsCompany" as const, limit: org.tokenQuota }
    }

    const cycleDay = normalizeCycleDay(input.cycleDay)
    await db.org.update(actor.orgID, { userTokenQuota: quota ?? undefined, tokenQuotaCycleDay: cycleDay })
    await db.audit.log({
      orgID: actor.orgID,
      actorID: actor.id,
      actorEmail: actor.email,
      action: "quota.company_user_updated",
      result: "allow",
      targetType: "org",
      targetID: actor.orgID,
    })
    return { error: undefined, quota }
  },
  "panel.quota.org.update",
)

export const updateTenantTokenQuota = action(
  async (orgID: string, input: { quota: string }) => {
    "use server"
    const actor = await requirePlatformAdmin()
    const raw = input.quota.trim()
    const quota = raw ? parseTokenAmount(raw) : null
    if (raw && quota === null) return { error: "quota.error.invalidAmount" as const }

    const db = store()
    const org = await db.org.get(orgID)
    await db.org.update(org.id, { tokenQuota: quota ?? undefined })
    await db.audit.log({
      orgID: org.id,
      actorID: actor.id,
      actorEmail: actor.email,
      action: "quota.company_pool_updated",
      result: "allow",
      targetType: "org",
      targetID: org.id,
    })
    return { error: undefined, quota }
  },
  "panel.admin.tenant.token_quota",
)

export const updateUserQuota = action(
  async (id: string, input: { quota: string }) => {
    "use server"
    const actor = await requireUser()
    if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }

    const db = store()
    const target = await db.users.findByID(id)
    if (!target || target.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }

    const raw = input.quota.trim()
    const quota = raw ? parseTokenAmount(raw) : null
    if (raw && quota === null) return { error: "quota.error.invalidAmount" as const }

    const org = await db.org.get(actor.orgID)
    if (quota !== null && org.tokenQuota !== undefined && quota > org.tokenQuota) {
      return { error: "quota.error.userExceedsCompany" as const, limit: org.tokenQuota }
    }

    await db.users.update(target.id, { tokenQuota: quota ?? undefined })
    await db.audit.log({
      orgID: actor.orgID,
      actorID: actor.id,
      actorEmail: actor.email,
      action: quota === null ? "quota.user_removed" : "quota.user_updated",
      result: "allow",
      targetType: "user",
      targetID: target.id,
    })
    return { error: undefined, quota }
  },
  "panel.quota.user.update",
)

export const login = action(async (form: FormData) => {
  "use server"
  const db = store()
  await db.ensureSeed()
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(form.get("password") ?? "")
  if (!email || !password) return { error: "login.required" as const }

  const user = await db.users.findByEmail(email)
  if (!user) {
    await db.audit.log({
      actorEmail: email,
      action: "auth.login_failed_unknown_account",
      result: "deny",
      targetType: "user",
    })
    return { error: "login.invalid" as const }
  }
  if (!passwordHashIsSupported(user.passwordHash)) {
    await db.audit.log({
      orgID: user.orgID,
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.login_failed_hash",
      result: "deny",
      targetType: "user",
      targetID: user.id,
    })
    return { error: "login.invalid" as const }
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await db.audit.log({
      orgID: user.orgID,
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.login_failed_bad_password",
      result: "deny",
      targetType: "user",
      targetID: user.id,
    })
    return { error: "login.invalid" as const }
  }
  if (user.status === "suspended" || user.status === "deleted") {
    await db.audit.log({
      orgID: user.orgID,
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.login_failed_disabled",
      result: "deny",
      targetType: "user",
      targetID: user.id,
    })
    return { error: "login.disabled" as const }
  }

  if (!canAccessPortal(user)) {
    await db.audit.log({
      orgID: user.orgID,
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.login_denied_not_admin",
      result: "deny",
      targetType: "user",
      targetID: user.id,
    })
    return { error: "login.notAdmin" as const }
  }

  await db.users.update(user.id, {
    status: "active",
    lastLoginAt: new Date().toISOString(),
  })
  await db.audit.log({
    actorID: user.id,
    actorEmail: user.email,
    action: "auth.login",
    result: "allow",
    targetType: "user",
    targetID: user.id,
  })
  const session = await usePanelSession()
  await session.update({ userID: user.id })
  if (user.isPlatformAdmin) {
    throw redirect("/4dm1n")
  }
  throw redirect("/app")
}, "panel.login")

export const createUser = action(async (form: FormData) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }

  const name = String(form.get("name") ?? "").trim()
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase()
  const role = String(form.get("role") ?? "member") as Role
  const canUseAgentUI = form.get("canUseAgentUI") === "on" || form.get("canUseAgentUI") === "true"
  const canUseRoutines = form.get("canUseRoutines") === "on" || form.get("canUseRoutines") === "true"
  const canChangePassword = form.get("canChangePassword") === "on" || form.get("canChangePassword") === "true"
  const auditExempt = actor.role === "owner" && (form.get("auditExempt") === "on" || form.get("auditExempt") === "true")
  const canOpenSettings = settingsFlag(form, "canOpenSettings")
  const defaultProvider = String(form.get("defaultProvider") ?? "").trim() || undefined
  const defaultModel = String(form.get("defaultModel") ?? "").trim() || undefined
  const tokenQuotaRaw = String(form.get("tokenQuota") ?? "").trim()
  const tokenQuota = tokenQuotaRaw ? parseTokenAmount(tokenQuotaRaw) : null
  const groupIDs = form.getAll("groupIds").map((value) => String(value))
  const access = accessFromForm(form)

  if (!name) return { error: "users.new.error.nameRequired" as const }
  if (!EMAIL.test(email)) return { error: "users.new.error.invalidEmail" as const }
  if (await store().users.findByEmail(email)) return { error: "users.new.error.emailTaken" as const }
  if (!CREATABLE_ROLES.includes(role)) return { error: "users.new.error.forbidden" as const }
  if (tokenQuotaRaw && tokenQuota === null) return { error: "quota.error.invalidAmount" as const }

  const db = store()
  const org = await db.org.get(actor.orgID)
  if (tokenQuota !== null && org.tokenQuota !== undefined && tokenQuota > org.tokenQuota) {
    return { error: "quota.error.userExceedsCompany" as const, limit: org.tokenQuota }
  }
  const seats = await db.users.count(actor.orgID)
  if (seats.total >= org.maxUsers) {
    return { error: "users.new.error.seatLimit" as const, limit: org.maxUsers, used: seats.total }
  }

  const password = generatePassword()
  const created = await db.users.create({
    orgID: actor.orgID,
    name,
    email,
    role,
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
    canUseAgentUI,
    canUseRoutines,
    canChangePassword,
    auditExempt,
    canOpenSettings,
    defaultProvider,
    defaultModel,
    tokenQuota: tokenQuota ?? undefined,
    accessOverrides: access,
  })
  if (groupIDs.length > 0) await db.groups.setUserGroups(created.id, groupIDs)
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "user.created",
    result: "allow",
    targetType: "user",
    targetID: created.id,
  })
  return { error: undefined, email: created.email, password }
}, "panel.user.create")

export const updateUserAccess = action(async (
  id: string,
  input: {
    access: AccessOverrides
    canOpenSettings?: boolean
    canChangePassword: boolean
    defaultProvider?: string
    defaultModel?: string
    groupIds: string[]
    auditExempt?: boolean
  },
) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const target = await db.users.findByID(id)
  if (!target || target.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  if (target.role === "owner" && actor.role !== "owner") return { error: "users.new.error.forbidden" as const }

  const exemptChanged =
    typeof input.auditExempt === "boolean" && input.auditExempt !== Boolean(target.auditExempt)
  if (exemptChanged && actor.role !== "owner") {
    return { error: "users.new.error.forbidden" as const }
  }
  const nextAuditExempt = typeof input.auditExempt === "boolean" ? input.auditExempt : target.auditExempt

  await db.users.update(id, {
    accessOverrides: JSON.stringify(input.access),
    canOpenSettings: input.canOpenSettings,
    canChangePassword: input.canChangePassword,
    auditExempt: nextAuditExempt,
    defaultProvider: input.defaultProvider?.trim() || undefined,
    defaultModel: input.defaultModel?.trim() || undefined,
    canUseAgentUI: input.access.agentui ?? target.canUseAgentUI,
    canUseRoutines: input.access.routines ?? target.canUseRoutines,
  })
  await db.groups.setUserGroups(id, input.groupIds)
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "user.access_updated",
    result: "allow",
    targetType: "user",
    targetID: id,
  })
  if (exemptChanged) {
    await db.audit.log({
      orgID: actor.orgID,
      actorID: actor.id,
      actorEmail: actor.email,
      action: "user.audit_exemption_updated",
      result: "allow",
      targetType: "user",
      targetID: id,
    })
  }
  return { error: undefined }
}, "panel.user.access")

export const resetUserPassword = action(async (id: string, password?: string) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  if (actor.id === id) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const target = await db.users.findByID(id)
  if (!target || target.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  if (target.role === "owner" && actor.role !== "owner") return { error: "users.new.error.forbidden" as const }

  const provided = password?.trim()
  if (provided && provided.length < 8) return { error: "users.password.error.tooShort" as const }

  const nextPassword = provided && provided.length > 0 ? provided : generatePassword(16)
  await db.users.update(id, {
    passwordHash: await hashPassword(nextPassword),
    mustChangePassword: true,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "user.password_reset",
    result: "allow",
    targetType: "user",
    targetID: id,
  })
  return { error: undefined, password: nextPassword }
}, "panel.user.password")

export const setUserRole = action(async (id: string, role: Role) => {
  "use server"
  const actor = await requireUser()
  if (actor.role !== "owner") return { error: "users.new.error.forbidden" as const }
  if (actor.id === id) return { error: "users.new.error.forbidden" as const }
  if (role === "owner" || !CREATABLE_ROLES.includes(role)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  await db.users.update(id, { role })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "user.role_changed",
    result: "allow",
    targetType: "user",
    targetID: id,
  })
  return { error: undefined }
}, "panel.user.role")

export const setUserStatus = action(async (id: string, status: "active" | "suspended") => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  if (actor.id === id) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const target = await db.users.findByID(id)
  if (!target || target.role === "owner") return { error: "users.new.error.forbidden" as const }
  await db.users.update(id, { status })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: status === "suspended" ? "user.suspended" : "user.reactivated",
    result: "allow",
    targetType: "user",
    targetID: id,
  })
  return { error: undefined }
}, "panel.user.status")

export const removeUser = action(async (id: string, confirmEmail: string) => {
  "use server"
  const actor = await requireUser()
  if (!canRemoveUsers(actor)) return { error: "users.new.error.forbidden" as const }
  if (actor.id === id) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const target = await db.users.findByID(id)
  if (!target || target.role === "owner") return { error: "users.new.error.forbidden" as const }
  if (target.email !== confirmEmail.trim().toLowerCase()) return { error: "user.detail.removeConfirm" as const }
  await db.users.update(id, { status: "deleted" })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "user.removed",
    result: "allow",
    targetType: "user",
    targetID: id,
  })
  throw redirect("/app/usuarios")
}, "panel.user.remove")

export const updateSettings = action(async (form: FormData) => {
  "use server"
  const actor = await requireUser()
  if (!canManageOrganization(actor)) return { error: "settings.ownerOnly" as const }
  const name = String(form.get("name") ?? "").trim()
  const ssoMode = String(form.get("ssoMode") ?? "optional") === "required" ? "required" : "optional"
  const offlineGraceHours = Math.min(720, Math.max(0, Number(form.get("offlineGraceHours") ?? 72)))
  const sessionMaxAgeHours = Math.min(720, Math.max(1, Number(form.get("sessionMaxAgeHours") ?? 12)))
  const logoUrl = String(form.get("logoUrl") ?? "").trim()
  const welcomeMessage = String(form.get("welcomeMessage") ?? "").trim()
  const brandColor = String(form.get("brandColor") ?? "").trim()
  const defaultProvider = String(form.get("defaultProvider") ?? "").trim()
  const defaultModel = String(form.get("defaultModel") ?? "").trim()
  const providerRestricted = form.get("providerRestricted") === "on" || form.get("providerRestricted") === "true"
  const allowLocalProviders = form.get("allowLocalProviders") === "on" || form.get("allowLocalProviders") === "true"

  if (!name) return { error: "users.new.error.nameRequired" as const }
  const db = store()
  if (defaultProvider) {
    const catalog = await db.providers.list(actor.orgID)
    // Tenants that never configured a catalog keep the legacy free-text default.
    if (catalog.length > 0) {
      const entry = catalog.find((provider) => provider.providerID === defaultProvider && provider.enabled)
      if (!entry) return { error: "providers.error.unknownDefault" as const }
    }
  }
  await db.org.update(actor.orgID, {
    name,
    ssoMode,
    offlineGraceHours,
    sessionMaxAgeHours,
    logoUrl: logoUrl || undefined,
    welcomeMessage: welcomeMessage || undefined,
    brandColor: brandColor || "#10b981",
    defaultProvider: defaultProvider || undefined,
    defaultModel: defaultModel || undefined,
    providerRestricted,
    allowLocalProviders,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "org.updated",
    result: "allow",
    targetType: "org",
  })
  return { error: undefined }
}, "panel.org.update")

// ==========================================
// GRUPOS DE ACESSO (PERFIS)
// ==========================================

function publicGroup(group: { id: string; name: string; description?: string; access: string; canOpenSettings: boolean }) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    access: parseOverrides(group.access),
    canOpenSettings: group.canOpenSettings,
  }
}

export type PublicGroup = ReturnType<typeof publicGroup>

export const listGroups = query(async () => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const groups = await db.groups.list(actor.orgID)
  return groups.map(publicGroup)
}, "panel.groups")

export const getGroup = query(async (id: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const group = await db.groups.findByID(id)
  if (!group || group.orgID !== actor.orgID) return null
  const memberIDs = await db.groups.members(id)
  return { ...publicGroup(group), memberIDs }
}, "panel.group")

export const createGroup = action(async (form: FormData) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  const name = String(form.get("name") ?? "").trim()
  if (!name) return { error: "groups.error.nameRequired" as const }
  const db = store()
  const created = await db.groups.create({
    orgID: actor.orgID,
    name,
    description: String(form.get("description") ?? "").trim() || undefined,
    access: accessFromForm(form),
    canOpenSettings: settingsFlag(form, "canOpenSettings") ?? true,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "group.created",
    result: "allow",
    targetType: "group",
    targetID: created.id,
  })
  return { error: undefined, id: created.id }
}, "panel.group.create")

export const updateGroup = action(async (id: string, input: {
  access: AccessOverrides
  canOpenSettings: boolean
}) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const group = await db.groups.findByID(id)
  if (!group || group.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  await db.groups.update(id, { access: input.access, canOpenSettings: input.canOpenSettings })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "group.updated",
    result: "allow",
    targetType: "group",
    targetID: id,
  })
  return { error: undefined }
}, "panel.group.update")

export const removeGroup = action(async (id: string) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const group = await db.groups.findByID(id)
  if (!group || group.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  await db.groups.remove(id)
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "group.removed",
    result: "allow",
    targetType: "group",
    targetID: id,
  })
  return { error: undefined }
}, "panel.group.remove")

export const setGroupMembers = action(async (id: string, userIDs: string[]) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const group = await db.groups.findByID(id)
  if (!group || group.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  const users = await db.users.list(actor.orgID)
  const allowed = new Set(users.map((user) => user.id))
  await db.groups.setMembers(id, userIDs.filter((userID) => allowed.has(userID)))
  return { error: undefined }
}, "panel.group.members")

// ==========================================
// CATÁLOGO DE PROVEDORES E PERMISSÕES
// ==========================================

function publicProvider(provider: ProviderDefinition) {
  return provider
}

export type ProviderInput = {
  providerID: string
  displayName: string
  kind?: "builtin" | "custom" | "proxy"
  protocol?: ProviderProtocol
  baseURL?: string
  apiKey?: string
  models?: unknown
  headers?: unknown
  env?: unknown
  enabled?: boolean
}

export const listProviders = query(async () => {
  "use server"
  const actor = await requireUser()
  const db = store()
  return (await db.providers.list(actor.orgID)).map(publicProvider)
}, "panel.providers")

export const getProvider = query(async (id: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const provider = await db.providers.findByID(id)
  if (!provider || provider.orgID !== actor.orgID) return null
  return publicProvider(provider)
}, "panel.provider")

export const getProviderGrants = query(async (scope: "group" | "user", scopeID: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const provider = scope === "group" ? await db.groups.findByID(scopeID) : await db.users.findByID(scopeID)
  if (!provider || provider.orgID !== actor.orgID) return []
  return db.providers.grants(scope, scopeID)
}, "panel.provider.grants")

export const getProviderUsage = query(async () => {
  "use server"
  const actor = await requireUser()
  const db = store()
  const [users, providers] = await Promise.all([db.users.list(actor.orgID), db.providers.list(actor.orgID)])
  const resolved = await Promise.all(users.map((user) => resolveUserAccess(user)))
  return providers.map((provider) => ({
    providerID: provider.providerID,
    count: resolved.filter((entry) => isProviderAllowed(entry.providers, provider.providerID)).length,
  }))
}, "panel.providers.usage")

export const testProviderConnection = action(
  async (input: { protocol: ProviderProtocol; baseURL: string; apiKey?: string }) => {
    "use server"
    await requireUser()
    const url = input.baseURL.trim().replace(/\/+$/, "")
    if (!isHttpUrl(url)) {
      return { error: "providers.error.invalidUrl" as const }
    }

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      }
      let targetUrl = `${url}/models`

      if (input.protocol === "anthropic") {
        targetUrl = url.endsWith("/v1") ? `${url}/models` : `${url}/v1/models`
        if (input.apiKey?.trim()) {
          headers["x-api-key"] = input.apiKey.trim()
          headers["anthropic-version"] = "2023-06-01"
        }
      } else {
        if (input.apiKey?.trim()) {
          headers["Authorization"] = `Bearer ${input.apiKey.trim()}`
        }
      }

      const response = await fetchProviderModels(targetUrl, headers)

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        return {
          error: `HTTP ${response.status}: ${text.slice(0, 200) || response.statusText}`,
        }
      }

      const data = (await response.json()) as any
      let models: Array<{ id: string; name: string }> = []
      if (Array.isArray(data?.data)) {
        models = data.data
          .map((m: any) => ({
            id: String(m.id || m.model || ""),
            name: String(m.name || m.display_name || m.id || ""),
          }))
          .filter((m: any) => m.id)
      } else if (Array.isArray(data)) {
        models = data
          .map((m: any) => ({
            id: String(m.id || m.model || m || ""),
            name: String(m.name || m.id || m || ""),
          }))
          .filter((m: any) => m.id)
      }

      return { ok: true, models }
    } catch (err: any) {
      return {
        error: err.name === "TimeoutError" ? "Timeout ao conectar (10s)" : err.message || "Erro de conexão",
      }
    }
  },
  "panel.provider.test",
)

export const listUserCredentials = query(async (targetUserID?: string) => {
  "use server"
  const actor = await requireUser()
  const uid = targetUserID && (actor.role === "owner" || actor.role === "admin") ? targetUserID : actor.id
  const db = store()
  const creds = await db.credentials.listByUser(uid)
  return creds.map((c) => ({
    providerID: c.providerID,
    maskedKey: c.apiKey.length > 8 ? `${c.apiKey.slice(0, 3)}...${c.apiKey.slice(-4)}` : "••••••••",
    updatedAt: c.updatedAt,
  }))
}, "panel.user.credentials")

export const saveUserCredential = action(async (input: { userID?: string; providerID: string; apiKey: string }) => {
  "use server"
  const actor = await requireUser()
  const uid = input.userID && (actor.role === "owner" || actor.role === "admin") ? input.userID : actor.id
  const key = input.apiKey.trim()
  if (!key) return { error: "A chave de API não pode estar em branco." }
  const db = store()
  await db.credentials.set(uid, input.providerID.trim(), key)
  return { success: true }
}, "panel.user.credential.save")

export const removeUserCredential = action(async (input: { userID?: string; providerID: string }) => {
  "use server"
  const actor = await requireUser()
  const uid = input.userID && (actor.role === "owner" || actor.role === "admin") ? input.userID : actor.id
  const db = store()
  await db.credentials.remove(uid, input.providerID.trim())
  return { success: true }
}, "panel.user.credential.remove")

export const createProvider = action(async (input: ProviderInput) => {  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }

  const providerID = input.providerID.trim().toLowerCase()
  const displayName = input.displayName.trim()
  if (!validProviderID(providerID)) return { error: "providers.error.invalidId" as const }
  if (!displayName) return { error: "providers.error.nameRequired" as const }

  const db = store()
  if (await db.providers.findByProviderID(actor.orgID, providerID)) return { error: "providers.error.duplicate" as const }

  const baseURL = input.baseURL?.trim()
  if (!baseURL || !isHttpUrl(baseURL)) {
    return { error: "providers.error.invalidUrl" as const }
  }

  const protocol: ProviderProtocol = input.protocol === "anthropic" ? "anthropic" : "openai"
  const npm = protocol === "anthropic" ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible"

  const created = await db.providers.create({
    orgID: actor.orgID,
    providerID,
    displayName,
    kind: "custom",
    protocol,
    npm,
    baseURL,
    apiKey: undefined,
    models: sanitizeModels(input.models),
    headers: sanitizeHeaders(input.headers),
    env: sanitizeEnv(input.env),
    enabled: input.enabled ?? true,
    createdBy: actor.id,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "provider.created",
    result: "allow",
    targetType: "provider",
    targetID: created.id,
  })
  return { error: undefined, id: created.id }
}, "panel.provider.create")

export const updateProvider = action(async (id: string, input: ProviderInput) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }

  const db = store()
  const provider = await db.providers.findByID(id)
  if (!provider || provider.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  if (provider.scope === "global") return { error: "users.new.error.forbidden" as const }

  const displayName = input.displayName.trim()
  if (!displayName) return { error: "providers.error.nameRequired" as const }
  const baseURL = (input.baseURL ?? provider.baseURL ?? "").trim()
  if (!isHttpUrl(baseURL)) return { error: "providers.error.invalidUrl" as const }

  const protocol: ProviderProtocol = input.protocol ?? provider.protocol ?? "openai"
  const npm = protocol === "anthropic" ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible"

  await db.providers.update(id, {
    displayName,
    protocol,
    npm,
    baseURL,
    apiKey: undefined,
    models: sanitizeModels(input.models),
    headers: sanitizeHeaders(input.headers),
    env: sanitizeEnv(input.env),
    enabled: input.enabled ?? provider.enabled,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "provider.updated",
    result: "allow",
    targetType: "provider",
    targetID: id,
  })
  return { error: undefined }
}, "panel.provider.update")

export const removeProvider = action(async (id: string) => {
  "use server"
  const actor = await requireUser()
  if (!canManageOrganization(actor)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const provider = await db.providers.findByID(id)
  if (!provider || provider.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  if (provider.scope === "global") return { error: "users.new.error.forbidden" as const }
  await db.providers.remove(id)
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "provider.removed",
    result: "allow",
    targetType: "provider",
    targetID: id,
  })
  return { error: undefined }
}, "panel.provider.remove")

export const listGlobalProviders = query(async () => {
  "use server"
  await requirePlatformAdmin()
  const db = store()
  return (await db.providers.listGlobal()).map(publicProvider)
}, "panel.admin.providers")

export const getGlobalProvider = query(async (id: string) => {
  "use server"
  await requirePlatformAdmin()
  const db = store()
  const provider = await db.providers.findByID(id)
  if (!provider || provider.scope !== "global") return null
  return publicProvider(provider)
}, "panel.admin.provider")

export const createGlobalProvider = action(async (input: ProviderInput) => {
  "use server"
  const actor = await requirePlatformAdmin()
  const providerID = input.providerID.trim().toLowerCase()
  const displayName = input.displayName.trim()
  if (!validProviderID(providerID)) return { error: "providers.error.invalidId" as const }
  if (!displayName) return { error: "providers.error.nameRequired" as const }

  const db = store()
  if (await db.providers.findByProviderID(actor.orgID, providerID)) {
    return { error: "providers.error.duplicate" as const }
  }

  const baseURL = input.baseURL?.trim()
  if (!baseURL || !isHttpUrl(baseURL)) return { error: "providers.error.invalidUrl" as const }
  const protocol: ProviderProtocol = input.protocol === "anthropic" ? "anthropic" : "openai"
  const npm = protocol === "anthropic" ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible"

  const created = await db.providers.create({
    orgID: actor.orgID,
    providerID,
    displayName,
    scope: "global",
    kind: "custom",
    protocol,
    npm,
    baseURL,
    apiKey: undefined,
    models: sanitizeModels(input.models),
    headers: sanitizeHeaders(input.headers),
    env: sanitizeEnv(input.env),
    enabled: input.enabled ?? true,
    createdBy: actor.id,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "provider.global_created",
    result: "allow",
    targetType: "provider",
    targetID: created.id,
  })
  return { error: undefined, id: created.id }
}, "panel.admin.provider.create")

export const updateGlobalProvider = action(async (id: string, input: ProviderInput) => {
  "use server"
  const actor = await requirePlatformAdmin()
  const db = store()
  const provider = await db.providers.findByID(id)
  if (!provider || provider.scope !== "global") return { error: "users.new.error.forbidden" as const }

  const displayName = input.displayName.trim()
  if (!displayName) return { error: "providers.error.nameRequired" as const }
  const baseURL = (input.baseURL ?? provider.baseURL ?? "").trim()
  if (!isHttpUrl(baseURL)) return { error: "providers.error.invalidUrl" as const }
  const protocol: ProviderProtocol = input.protocol ?? provider.protocol ?? "openai"
  const npm = protocol === "anthropic" ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible"

  await db.providers.update(id, {
    displayName,
    protocol,
    npm,
    baseURL,
    apiKey: undefined,
    models: sanitizeModels(input.models),
    headers: sanitizeHeaders(input.headers),
    env: sanitizeEnv(input.env),
    enabled: input.enabled ?? provider.enabled,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "provider.global_updated",
    result: "allow",
    targetType: "provider",
    targetID: id,
  })
  return { error: undefined }
}, "panel.admin.provider.update")

export const removeGlobalProvider = action(async (id: string) => {
  "use server"
  const actor = await requirePlatformAdmin()
  const db = store()
  const provider = await db.providers.findByID(id)
  if (!provider || provider.scope !== "global") return { error: "users.new.error.forbidden" as const }
  await db.providers.remove(id)
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "provider.global_removed",
    result: "allow",
    targetType: "provider",
    targetID: id,
  })
  return { error: undefined }
}, "panel.admin.provider.remove")

export const setProviderGrants = action(
  async (
    scope: "group" | "user",
    scopeID: string,
    grants: Array<{ providerID: string; effect: ProviderEffect }>,
  ) => {
    "use server"
    const actor = await requireUser()
    if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
    const db = store()
    const target = scope === "group" ? await db.groups.findByID(scopeID) : await db.users.findByID(scopeID)
    if (!target || target.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }

    const catalog = new Set((await db.providers.list(actor.orgID)).map((provider) => provider.providerID))
    const clean = grants.filter((grant) => catalog.has(grant.providerID))
    await db.providers.setGrants(
      scope,
      scopeID,
      clean.map((grant) => ({ scope, scopeID, providerID: grant.providerID, effect: grant.effect })),
    )
    await db.audit.log({
      orgID: actor.orgID,
      actorID: actor.id,
      actorEmail: actor.email,
      action: "provider.access_changed",
      result: "allow",
      targetType: scope,
      targetID: scopeID,
    })
    return { error: undefined }
  },
  "panel.provider.grants.set",
)

// ==========================================
// AÇÕES DO SUPER-ADMIN (GESTÃO DE TENANTS)
// ==========================================

export const requirePlatformMe = query(async () => {
  "use server"
  const admin = await requirePlatformAdmin()
  return publicUser(admin)
}, "panel.admin.me")

export const listTenants = query(async () => {
  "use server"
  await requirePlatformAdmin()
  const db = store()
  return db.org.list()
}, "panel.admin.tenants")

export const getTenant = query(async (id: string) => {
  "use server"
  await requirePlatformAdmin()
  const db = store()
  const org = await db.org.get(id)
  const users = await db.users.list(id)
  return { org, users: users.map(publicUser) }
}, "panel.admin.tenant")

export const getPlatformStats = query(async () => {
  "use server"
  await requirePlatformAdmin()
  const db = store()
  return db.org.stats()
}, "panel.admin.stats")

export const listPlans = query(async (activeOnly?: boolean) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  return db.plans.list({ activeOnly: activeOnly ?? !actor.isPlatformAdmin })
}, "panel.plans")

export const createPlan = action(async (form: FormData) => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()

  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
  const description = String(form.get("description") ?? "").trim() || undefined
  const pricingMode = String(form.get("pricingMode") ?? "per_user") === "package" ? "package" : "per_user"
  const priceCents = parseCurrencyToCents(form.get("price"))
  const includedUsersRaw = Number(form.get("includedUsers") ?? 0)
  const includedUsers = pricingMode === "package" ? Math.max(1, includedUsersRaw || 1) : undefined
  const extraUserPriceCents =
    pricingMode === "package" ? parseCurrencyToCents(form.get("extraUserPrice")) : undefined
  const minUsersRaw = Number(form.get("minUsers") ?? 1)
  const minUsers = Math.max(1, minUsersRaw || 1)
  const maxUsersRaw = Number(form.get("maxUsers") ?? 0)
  const maxUsers = maxUsersRaw > 0 ? Math.max(minUsers, maxUsersRaw) : undefined
  const isActive = form.get("isActive") !== null
  const sortOrderRaw = Number(form.get("sortOrder") ?? 0)
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0

  if (!name) return { error: "admin.plans.error.nameRequired" as const }
  if (!slug) return { error: "admin.plans.error.slugRequired" as const }
  if (priceCents <= 0) return { error: "admin.plans.error.priceRequired" as const }
  if (await db.plans.findBySlug(slug)) return { error: "admin.plans.error.slugTaken" as const }

  const plan = await db.plans.create({
    name,
    slug,
    description,
    pricingMode,
    priceCents,
    includedUsers,
    extraUserPriceCents,
    minUsers,
    maxUsers,
    isActive,
    sortOrder,
  })

  await db.audit.log({
    orgID: admin.orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "plan.created",
    result: "allow",
    targetType: "plan",
    targetID: plan.id,
  })

  return { error: undefined, planId: plan.id, planName: plan.name }
}, "panel.admin.plan.create")

export const updatePlan = action(async (planID: string, form: FormData) => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()

  const current = await db.plans.findByID(planID)
  if (!current) return { error: "admin.plans.error.notFound" as const }

  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
  const description = String(form.get("description") ?? "").trim() || undefined
  const pricingMode = String(form.get("pricingMode") ?? "per_user") === "package" ? "package" : "per_user"
  const priceCents = parseCurrencyToCents(form.get("price"))
  const includedUsersRaw = Number(form.get("includedUsers") ?? 0)
  const includedUsers = pricingMode === "package" ? Math.max(1, includedUsersRaw || 1) : undefined
  const extraUserPriceCents =
    pricingMode === "package" ? parseCurrencyToCents(form.get("extraUserPrice")) : undefined
  const minUsersRaw = Number(form.get("minUsers") ?? 1)
  const minUsers = Math.max(1, minUsersRaw || 1)
  const maxUsersRaw = Number(form.get("maxUsers") ?? 0)
  const maxUsers = maxUsersRaw > 0 ? Math.max(minUsers, maxUsersRaw) : undefined
  const isActive = form.get("isActive") !== null
  const sortOrderRaw = Number(form.get("sortOrder") ?? 0)
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0

  if (!name) return { error: "admin.plans.error.nameRequired" as const }
  if (!slug) return { error: "admin.plans.error.slugRequired" as const }
  if (priceCents <= 0) return { error: "admin.plans.error.priceRequired" as const }
  const slugOwner = await db.plans.findBySlug(slug)
  if (slugOwner && slugOwner.id !== planID) return { error: "admin.plans.error.slugTaken" as const }

  await db.plans.update(planID, {
    name,
    slug,
    description,
    pricingMode,
    priceCents,
    includedUsers,
    extraUserPriceCents,
    minUsers,
    maxUsers,
    isActive,
    sortOrder,
  })

  await db.audit.log({
    orgID: admin.orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "plan.updated",
    result: "allow",
    targetType: "plan",
    targetID: planID,
  })

  return { error: undefined }
}, "panel.admin.plan.update")

export const setPlanActive = action(async (planID: string, isActive: boolean) => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()
  await db.plans.update(planID, { isActive })
  await db.audit.log({
    orgID: admin.orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: isActive ? "plan.activated" : "plan.deactivated",
    result: "allow",
    targetType: "plan",
    targetID: planID,
  })
  return { error: undefined }
}, "panel.admin.plan.active")

export const removePlan = action(async (planID: string) => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()
  await db.plans.remove(planID)
  await db.audit.log({
    orgID: admin.orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "plan.removed",
    result: "allow",
    targetType: "plan",
    targetID: planID,
  })
  return { error: undefined }
}, "panel.admin.plan.remove")

export const setTenantPlan = action(async (orgID: string, planID: string) => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()
  const org = await db.org.get(orgID)
  if (planID) {
    const plan = await db.plans.findByID(planID)
    if (!plan) return { error: "admin.plans.error.notFound" as const }
    const limitError = seatLimitError(plan, org.maxUsers)
    if (limitError) return limitError
  }
  await db.org.update(orgID, { planID: planID || undefined })
  await db.audit.log({
    orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "tenant.plan_changed",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })
  return { error: undefined }
}, "panel.admin.tenant.plan")

export const createTenant = action(async (form: FormData) => {
  "use server"
  const admin = await requirePlatformAdmin()

  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
  const maxUsers = Math.max(1, Number(form.get("maxUsers") ?? 10))
  const ownerName = String(form.get("ownerName") ?? "").trim()
  const ownerEmail = String(form.get("ownerEmail") ?? "").trim().toLowerCase()
  const logoUrl = String(form.get("logoUrl") ?? "").trim() || undefined
  const welcomeMessage = String(form.get("welcomeMessage") ?? "").trim() || undefined
  const planID = String(form.get("planID") ?? "").trim() || undefined
  const planType = String(form.get("planType") ?? "trial") === "paid" ? "paid" : "trial"
  const trialDaysRaw = Number(form.get("trialDays") ?? 14)
  const trialDays = planType === "trial" ? (isNaN(trialDaysRaw) || trialDaysRaw <= 0 ? 14 : trialDaysRaw) : undefined
  const resellerID = String(form.get("resellerID") ?? "").trim() || undefined

  if (!name) return { error: "admin.tenants.error.nameRequired" as const }
  if (!slug) return { error: "admin.tenants.error.slugRequired" as const }
  if (!ownerName) return { error: "users.new.error.nameRequired" as const }
  if (!EMAIL.test(ownerEmail)) return { error: "users.new.error.invalidEmail" as const }

  const db = store()
  const existingOrg = await db.org.findBySlug(slug)
  if (existingOrg) return { error: "admin.tenants.error.slugTaken" as const }

  const existingUser = await db.users.findByEmail(ownerEmail)
  if (existingUser) return { error: "users.new.error.emailTaken" as const }

  const plan = planID ? await db.plans.findByID(planID) : undefined
  if (planID && !plan) return { error: "admin.plans.error.notFound" as const }
  const planLimitError = seatLimitError(plan, maxUsers)
  if (planLimitError) return planLimitError

  // 1. Criar Organização / Empresa
  const org = await db.org.create({
    name,
    slug,
    maxUsers,
    contactEmail: ownerEmail,
    logoUrl,
    welcomeMessage,
    planType,
    trialDays,
    resellerID,
    planID,
  })

  // 2. Criar Gestor / Proprietário da Empresa com senha temporária
  const tempPassword = generatePassword(16)
  const user = await db.users.create({
    orgID: org.id,
    name: ownerName,
    email: ownerEmail,
    role: "owner",
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
  })

  // 3. Auditoria
  await db.audit.log({
    orgID: org.id,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "tenant.created",
    result: "allow",
    targetType: "org",
    targetID: org.id,
  })

  return {
    error: undefined,
    tenantId: org.id,
    tenantName: org.name,
    ownerEmail: user.email,
    tempPassword,
  }
}, "panel.admin.tenant.create")

export const setTenantStatus = action(async (orgID: string, status: "active" | "suspended") => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()
  await db.org.update(orgID, { status })
  await db.audit.log({
    orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: status === "suspended" ? "tenant.suspended" : "tenant.reactivated",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })
  return { error: undefined }
}, "panel.admin.tenant.status")

export const updateTenantLimits = action(async (orgID: string, maxUsers: number) => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()
  const org = await db.org.get(orgID)
  const plan = org.planID ? await db.plans.findByID(org.planID) : undefined
  const limitError = seatLimitError(plan, maxUsers)
  if (limitError) return limitError
  await db.org.update(orgID, { maxUsers })
  await db.audit.log({
    orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "tenant.limits_updated",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })
  return { error: undefined }
}, "panel.admin.tenant.limits")

export const extendTenantTrial = action(async (orgID: string, days: number) => {
  "use server"
  const admin = await requirePlatformAdmin()
  if (isNaN(days) || days <= 0) return { error: "admin.trial.invalidDays" as const }

  const db = store()
  const org = await db.org.get(orgID)
  const baseTime = org.trialEndsAt ? Math.max(Date.now(), new Date(org.trialEndsAt).getTime()) : Date.now()
  const newEndsAt = new Date(baseTime + days * 86400000).toISOString()

  await db.org.update(orgID, {
    planType: "trial",
    trialEndsAt: newEndsAt,
    status: "active",
  })

  await db.audit.log({
    orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "tenant.trial_extended",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })

  return { error: undefined, newEndsAt }
}, "panel.admin.tenant.extendTrial")

export const setTenantPlanType = action(async (orgID: string, planType: "trial" | "paid", trialDays = 14) => {
  "use server"
  const admin = await requirePlatformAdmin()
  const db = store()
  const trialEndsAt = planType === "trial" ? new Date(Date.now() + trialDays * 86400000).toISOString() : undefined

  await db.org.update(orgID, {
    planType,
    trialEndsAt,
    status: "active",
  })

  await db.audit.log({
    orgID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "tenant.plan_updated",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })

  return { error: undefined }
}, "panel.admin.tenant.planType")

// ==========================================
// MÓDULO DE GESTÃO DE REVENDEDORES (RESELLERS)
// ==========================================

export const listResellers = query(async () => {
  "use server"
  await requirePlatformAdmin()
  const db = store()
  return db.resellers.list()
}, "panel.admin.resellers.list")

export const getReseller = query(async (id: string) => {
  "use server"
  const actor = await requireUser()
  const db = store()
  if (!actor.isPlatformAdmin && (!actor.isReseller || actor.resellerID !== id)) {
    throw redirect("/app")
  }
  const reseller = await db.resellers.findByID(id)
  if (!reseller) return null
  const stats = await db.resellers.stats(id)
  const clientOrgs = await db.org.listByReseller(id)
  return { reseller, stats, clientOrgs }
}, "panel.reseller.get")

export const createReseller = action(async (form: FormData) => {
  "use server"
  const admin = await requirePlatformAdmin()

  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
  const contactName = String(form.get("contactName") ?? "").trim() || undefined
  const contactEmail = String(form.get("contactEmail") ?? "").trim().toLowerCase()
  const contactPhone = String(form.get("contactPhone") ?? "").trim() || undefined
  const commissionRateRaw = Number(form.get("commissionRate") ?? 20)
  const commissionRate = isNaN(commissionRateRaw) ? 0.20 : commissionRateRaw / 100

  if (!name) return { error: "admin.resellers.error.nameRequired" as const }
  if (!slug) return { error: "admin.resellers.error.slugRequired" as const }
  if (!EMAIL.test(contactEmail)) return { error: "users.new.error.invalidEmail" as const }

  const db = store()
  const existing = await db.resellers.findBySlug(slug)
  if (existing) return { error: "admin.resellers.error.slugTaken" as const }

  const existingUser = await db.users.findByEmail(contactEmail)
  if (existingUser) return { error: "users.new.error.emailTaken" as const }

  const reseller = await db.resellers.create({
    name,
    slug,
    contactName,
    contactEmail,
    contactPhone,
    commissionRate,
  })

  // Cria usuário para o revendedor acessar o painel de revenda
  const tempPassword = generatePassword(16)
  const user = await db.users.create({
    orgID: DEFAULT_ORG_ID,
    name: contactName || name,
    email: contactEmail,
    role: "admin",
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
    isReseller: true,
    resellerID: reseller.id,
  })

  await db.audit.log({
    orgID: DEFAULT_ORG_ID,
    actorID: admin.id,
    actorEmail: admin.email,
    action: "reseller.created",
    result: "allow",
    targetType: "reseller",
    targetID: reseller.id,
  })

  return {
    error: undefined,
    resellerId: reseller.id,
    resellerName: reseller.name,
    contactEmail: user.email,
    tempPassword,
  }
}, "panel.admin.reseller.create")

export const requireResellerMe = query(async () => {
  "use server"
  const actor = await requireReseller()
  const db = store()
  await db.ensureSeed()
  const resellerID = actor.resellerID || (await db.resellers.list())[0]?.id
  const reseller = resellerID ? await db.resellers.findByID(resellerID) : null
  return {
    user: publicUser(actor),
    reseller,
  }
}, "panel.reseller.me")

export const getResellerDashboard = query(async () => {
  "use server"
  const actor = await requireReseller()
  const db = store()
  const resellerID = actor.resellerID || (await db.resellers.list())[0]?.id
  if (!resellerID) {
    return {
      reseller: null,
      stats: {
        totalTenants: 0,
        activeTenants: 0,
        trialTenants: 0,
        expiredTenants: 0,
        suspendedTenants: 0,
        totalUsers: 0,
        estimatedMonthlyRevenue: 0,
        commissionRate: 0.20,
        estimatedCommission: 0,
      },
      tenants: [],
    }
  }

  const reseller = await db.resellers.findByID(resellerID)
  const stats = await db.resellers.stats(resellerID)
  const tenants = await db.org.listByReseller(resellerID)

  return {
    reseller,
    stats,
    tenants,
  }
}, "panel.reseller.dashboard")

export const getResellerTenant = query(async (id: string) => {
  "use server"
  const actor = await requireReseller()
  const db = store()
  const org = await db.org.get(id)

  // Isolamento multi-tenant rigoroso: revendedor só pode acessar empresas associadas a ele
  if (!actor.isPlatformAdmin && org.resellerID !== actor.resellerID) {
    throw redirect("/revenda")
  }

  const users = await db.users.list(id)
  return { org, users: users.map(publicUser) }
}, "panel.reseller.tenant")

export const createTenantByReseller = action(async (form: FormData) => {
  "use server"
  const actor = await requireReseller()
  const db = store()

  const resellerID = actor.resellerID
  if (!resellerID && !actor.isPlatformAdmin) {
    return { error: "reseller.error.unauthorized" as const }
  }

  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
  const maxUsers = Math.max(1, Number(form.get("maxUsers") ?? 10))
  const ownerName = String(form.get("ownerName") ?? "").trim()
  const ownerEmail = String(form.get("ownerEmail") ?? "").trim().toLowerCase()
  const logoUrl = String(form.get("logoUrl") ?? "").trim() || undefined
  const welcomeMessage = String(form.get("welcomeMessage") ?? "").trim() || undefined
  const planID = String(form.get("planID") ?? "").trim() || undefined
  const trialDaysRaw = Number(form.get("trialDays") ?? 14)
  const trialDays = isNaN(trialDaysRaw) || trialDaysRaw <= 0 ? 14 : trialDaysRaw

  if (!name) return { error: "admin.tenants.error.nameRequired" as const }
  if (!slug) return { error: "admin.tenants.error.slugRequired" as const }
  if (!ownerName) return { error: "users.new.error.nameRequired" as const }
  if (!EMAIL.test(ownerEmail)) return { error: "users.new.error.invalidEmail" as const }

  const existingOrg = await db.org.findBySlug(slug)
  if (existingOrg) return { error: "admin.tenants.error.slugTaken" as const }

  const existingUser = await db.users.findByEmail(ownerEmail)
  if (existingUser) return { error: "users.new.error.emailTaken" as const }

  const plan = planID ? await db.plans.findByID(planID) : undefined
  if (planID && (!plan || (!plan.isActive && !actor.isPlatformAdmin))) {
    return { error: "admin.plans.error.notFound" as const }
  }
  const planLimitError = seatLimitError(plan, maxUsers)
  if (planLimitError) return planLimitError

  // Provisiona a nova empresa cliente atribuída a esta revenda
  const org = await db.org.create({
    name,
    slug,
    maxUsers,
    contactEmail: ownerEmail,
    logoUrl,
    welcomeMessage,
    planType: "trial",
    trialDays,
    resellerID: resellerID || undefined,
    planID,
  })

  // Cria o gestor inicial da empresa cliente
  const tempPassword = generatePassword(16)
  const user = await db.users.create({
    orgID: org.id,
    name: ownerName,
    email: ownerEmail,
    role: "owner",
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
  })

  await db.audit.log({
    orgID: org.id,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "tenant.created_by_reseller",
    result: "allow",
    targetType: "org",
    targetID: org.id,
  })

  return {
    error: undefined,
    tenantId: org.id,
    tenantName: org.name,
    ownerEmail: user.email,
    tempPassword,
  }
}, "panel.reseller.tenant.create")

export const setResellerTenantPlan = action(async (orgID: string, planID: string) => {
  "use server"
  const actor = await requireReseller()
  const db = store()
  const org = await db.org.get(orgID)

  if (!actor.isPlatformAdmin && org.resellerID !== actor.resellerID) {
    return { error: "reseller.error.unauthorized" as const }
  }

  if (planID) {
    const plan = await db.plans.findByID(planID)
    if (!plan || (!plan.isActive && !actor.isPlatformAdmin)) {
      return { error: "admin.plans.error.notFound" as const }
    }
    const limitError = seatLimitError(plan, org.maxUsers)
    if (limitError) return limitError
  }

  await db.org.update(orgID, { planID: planID || undefined })
  await db.audit.log({
    orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "tenant.plan_changed",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })
  return { error: undefined }
}, "panel.reseller.tenant.plan")

export const setResellerTenantStatus = action(async (orgID: string, status: "active" | "suspended") => {
  "use server"
  const actor = await requireReseller()
  const db = store()
  const org = await db.org.get(orgID)

  if (!actor.isPlatformAdmin && org.resellerID !== actor.resellerID) {
    return { error: "reseller.error.unauthorized" as const }
  }

  await db.org.update(orgID, { status })
  await db.audit.log({
    orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: status === "suspended" ? "tenant.suspended" : "tenant.reactivated",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })
  return { error: undefined }
}, "panel.reseller.tenant.status")

export const updateResellerTenantLimits = action(async (orgID: string, maxUsers: number) => {
  "use server"
  const actor = await requireReseller()
  const db = store()
  const org = await db.org.get(orgID)

  if (!actor.isPlatformAdmin && org.resellerID !== actor.resellerID) {
    return { error: "reseller.error.unauthorized" as const }
  }

  const plan = org.planID ? await db.plans.findByID(org.planID) : undefined
  const limitError = seatLimitError(plan, maxUsers)
  if (limitError) return limitError

  await db.org.update(orgID, { maxUsers })
  await db.audit.log({
    orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "tenant.limits_updated",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })
  return { error: undefined }
}, "panel.reseller.tenant.limits")

export const extendResellerTenantTrial = action(async (orgID: string, days: number) => {
  "use server"
  const actor = await requireReseller()
  if (isNaN(days) || days <= 0) return { error: "admin.trial.invalidDays" as const }

  const db = store()
  const org = await db.org.get(orgID)

  if (!actor.isPlatformAdmin && org.resellerID !== actor.resellerID) {
    return { error: "reseller.error.unauthorized" as const }
  }

  const baseTime = org.trialEndsAt ? Math.max(Date.now(), new Date(org.trialEndsAt).getTime()) : Date.now()
  const newEndsAt = new Date(baseTime + days * 86400000).toISOString()

  await db.org.update(orgID, {
    planType: "trial",
    trialEndsAt: newEndsAt,
    status: "active",
  })

  await db.audit.log({
    orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "tenant.trial_extended",
    result: "allow",
    targetType: "org",
    targetID: orgID,
  })

  return { error: undefined, newEndsAt }
}, "panel.reseller.tenant.extendTrial")
