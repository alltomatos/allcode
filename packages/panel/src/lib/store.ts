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
  createdAt: string
  lastLoginAt?: string
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
  createdAt: string
}

export type UserKPIs = {
  totalSessions: number
  totalTokens: number
  totalCostUsd: number
  totalDurationMs: number
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
    | "canUseAgentUI"
    | "canUseRoutines"
    | "canChangePassword"
  >
>

export type OrgPatch = Partial<
  Pick<Organization, "name" | "slug" | "status" | "maxUsers" | "contactEmail" | "logoUrl" | "welcomeMessage" | "brandColor" | "ssoMode" | "offlineGraceHours" | "sessionMaxAgeHours">
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
    }): Promise<PanelUser>
    update(id: string, patch: UserPatch): Promise<PanelUser | undefined>
    count(orgID?: string): Promise<{ total: number; active: number; invited: number; suspended: number }>
  }
  sessions: {
    create(input: Omit<SessionAudit, "id" | "createdAt">): Promise<SessionAudit>
    listByUser(userID: string, limit?: number): Promise<SessionAudit[]>
    getUserKPIs(userID: string): Promise<UserKPIs>
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
    sessions: {
      async create(input) {
        const item: SessionAudit = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        return item
      },
      async listByUser(userID, limit = 50) {
        return []
      },
      async getUserKPIs(userID) {
        return {
          totalSessions: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          totalDurationMs: 0,
        }
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
  created_at: string
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
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? undefined,
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
    createdAt: row.created_at,
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
    createdAt: row.created_at,
  }
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
            `UPDATE organization SET name = ?, slug = ?, status = ?, max_users = ?, contact_email = ?, logo_url = ?, welcome_message = ?, brand_color = ?, sso_mode = ?, offline_grace_hours = ?, session_max_age_hours = ? WHERE id = ?`,
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
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO panel_user (id, org_id, name, email, role, status, password_hash, must_change_password, is_platform_admin, can_use_agentui, can_use_routines, can_change_password, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            `UPDATE panel_user SET name = ?, email = ?, role = ?, status = ?, password_hash = ?, must_change_password = ?, last_login_at = ?, can_use_agentui = ?, can_use_routines = ?, can_change_password = ? WHERE id = ?`,
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
    sessions: {
      async create(input) {
        const item: SessionAudit = {
          ...input,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        await db
          .prepare(
            `INSERT INTO session_audit (id, session_id, user_id, org_id, title, summary, workspace, started_at, ended_at, tokens_total, tokens_input, tokens_output, tokens_reasoning, cost_usd, duration_ms, messages_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
