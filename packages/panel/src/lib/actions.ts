import { action, query, redirect } from "@solidjs/router"
import { canManageOrganization, canManageUsers, canRemoveUsers, currentUser, requirePlatformAdmin, requireUser } from "./auth"
import { generatePassword, hashPassword, verifyPassword } from "./crypto"
import { usePanelSession } from "./session"
import { store, type PanelUser, type Role } from "./store"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CREATABLE_ROLES: Role[] = ["admin", "member"]

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
  return publicUser(user)
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

export const logout = action(async () => {
  "use server"
  const user = await currentUser()
  const db = store()
  if (user) {
    await db.audit.log({
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.logout",
      result: "allow",
      targetType: "user",
      targetID: user.id,
    })
  }
  const session = await usePanelSession()
  await session.clear()
  throw redirect("/login")
}, "panel.logout")

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
  })
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

export const updateUserPermissions = action(async (
  id: string,
  permissions: {
    canUseAgentUI: boolean
    canUseRoutines: boolean
    canChangePassword: boolean
  },
) => {
  "use server"
  const actor = await requireUser()
  if (!canManageUsers(actor)) return { error: "users.new.error.forbidden" as const }
  const db = store()
  const target = await db.users.findByID(id)
  if (!target || target.orgID !== actor.orgID) return { error: "users.new.error.forbidden" as const }
  await db.users.update(id, {
    canUseAgentUI: permissions.canUseAgentUI,
    canUseRoutines: permissions.canUseRoutines,
    canChangePassword: permissions.canChangePassword,
  })
  await db.audit.log({
    orgID: actor.orgID,
    actorID: actor.id,
    actorEmail: actor.email,
    action: "user.permissions_updated",
    result: "allow",
    targetType: "user",
    targetID: id,
  })
  return { error: undefined }
}, "panel.user.permissions")

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

  if (!name) return { error: "users.new.error.nameRequired" as const }
  const db = store()
  await db.org.update(actor.orgID, {
    name,
    ssoMode,
    offlineGraceHours,
    sessionMaxAgeHours,
    logoUrl: logoUrl || undefined,
    welcomeMessage: welcomeMessage || undefined,
    brandColor: brandColor || "#10b981",
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
