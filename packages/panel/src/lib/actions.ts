import { action, query, redirect } from "@solidjs/router"
import { canManageOrganization, canManageUsers, canRemoveUsers, currentUser, requirePlatformAdmin, requireUser } from "./auth"
import { generatePassword, hashPassword, verifyPassword } from "./crypto"
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
import { store, type PanelUser, type ProviderDefinition, type Role } from "./store"
import { resolveUserAccess } from "./user-access"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CREATABLE_ROLES: Role[] = ["admin", "member"]

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
    canUseAgentUI: user.canUseAgentUI,
    canUseRoutines: user.canUseRoutines,
    canChangePassword: user.canChangePassword,
    canOpenSettings: user.canOpenSettings,
    defaultProvider: user.defaultProvider,
    defaultModel: user.defaultModel,
    access: parseOverrides(user.accessOverrides),
    appVersion: user.appVersion,
    appVersionAt: user.appVersionAt,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

export type PublicUser = ReturnType<typeof publicUser>

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
  if (!user || user.orgID !== actor.orgID) return { totalSessions: 0, totalTokens: 0, totalCostUsd: 0, totalDurationMs: 0 }
  return db.sessions.getUserKPIs(id)
}, "panel.user.kpis")

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
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await db.audit.log({
      actorEmail: email,
      action: "auth.login_failed",
      result: "deny",
      targetType: "user",
    })
    return { error: "login.invalid" as const }
  }
  if (user.status === "suspended" || user.status === "deleted") {
    await db.audit.log({
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.login_failed",
      result: "deny",
      targetType: "user",
      targetID: user.id,
    })
    return { error: "login.disabled" as const }
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
  const canOpenSettings = settingsFlag(form, "canOpenSettings")
  const defaultProvider = String(form.get("defaultProvider") ?? "").trim() || undefined
  const defaultModel = String(form.get("defaultModel") ?? "").trim() || undefined
  const groupIDs = form.getAll("groupIds").map((value) => String(value))
  const access = accessFromForm(form)

  if (!name) return { error: "users.new.error.nameRequired" as const }
  if (!EMAIL.test(email)) return { error: "users.new.error.invalidEmail" as const }
  if (await store().users.findByEmail(email)) return { error: "users.new.error.emailTaken" as const }
  if (!CREATABLE_ROLES.includes(role)) return { error: "users.new.error.forbidden" as const }

  const db = store()
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
    canOpenSettings,
    defaultProvider,
    defaultModel,
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
  },
) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const target = await db.users.findByID(id)
  if (!target || target.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  if (target.role === "owner" && actor.role !== "owner") return { error: "users.new.error.forbidden" as const }

  await db.users.update(id, {
    accessOverrides: JSON.stringify(input.access),
    canOpenSettings: input.canOpenSettings,
    canChangePassword: input.canChangePassword,
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
  kind: "builtin" | "custom" | "proxy"
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
  if ((input.kind === "custom" || input.kind === "proxy") && (!baseURL || !isHttpUrl(baseURL))) {
    return { error: "providers.error.invalidUrl" as const }
  }

  const created = await db.providers.create({
    orgID: actor.orgID,
    providerID,
    displayName,
    kind: input.kind,
    npm: input.kind === "custom" || input.kind === "proxy" ? CUSTOM_PROVIDER_NPM : undefined,
    baseURL: input.kind === "custom" || input.kind === "proxy" ? baseURL : undefined,
    apiKey: input.apiKey?.trim() || undefined,
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

  const displayName = input.displayName.trim()
  if (!displayName) return { error: "providers.error.nameRequired" as const }
  const baseURL = (input.baseURL ?? provider.baseURL ?? "").trim()
  const isProxyOrCustom = provider.kind === "custom" || provider.kind === "proxy"
  if (isProxyOrCustom && !isHttpUrl(baseURL)) return { error: "providers.error.invalidUrl" as const }

  await db.providers.update(id, {
    displayName,
    baseURL: isProxyOrCustom ? baseURL : undefined,
    apiKey: input.apiKey !== undefined ? (input.apiKey.trim() || undefined) : provider.apiKey,
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

export const createTenant = action(async (form: FormData) => {
  "use server"
  const admin = await requirePlatformAdmin()

  const name = String(form.get("name") ?? "").trim()
  const slug = String(form.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
  const maxUsers = Math.max(1, Number(form.get("maxUsers") ?? 10))
  const ownerName = String(form.get("ownerName") ?? "").trim()
  const ownerEmail = String(form.get("ownerEmail") ?? "").trim().toLowerCase()

  if (!name) return { error: "admin.tenants.error.nameRequired" as const }
  if (!slug) return { error: "admin.tenants.error.slugRequired" as const }
  if (!ownerName) return { error: "users.new.error.nameRequired" as const }
  if (!EMAIL.test(ownerEmail)) return { error: "users.new.error.invalidEmail" as const }

  const db = store()
  const existingOrg = await db.org.findBySlug(slug)
  if (existingOrg) return { error: "admin.tenants.error.slugTaken" as const }

  const existingUser = await db.users.findByEmail(ownerEmail)
  if (existingUser) return { error: "users.new.error.emailTaken" as const }

  // 1. Criar Organização / Tenant
  const org = await db.org.create({
    name,
    slug,
    maxUsers,
    contactEmail: ownerEmail,
  })

  // 2. Criar Gestor / Proprietário do Tenant com senha temporária
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
