import { Database } from "bun:sqlite"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { hashPassword } from "../src/lib/crypto"
import { d1Store, type Store } from "../src/lib/store"
import { POST as postSessionAudit } from "../src/routes/api/v1/sessions/audit"
import { POST as postLogin } from "../src/routes/api/v1/auth/login"
import { POST as postStatus } from "../src/routes/api/v1/auth/status"

function d1From(db: Database) {
  return {
    prepare(sql: string) {
      const statement = db.query(sql)
      let params: unknown[] = []
      const prepared = {
        bind(...values: unknown[]) {
          params = values
          return prepared
        },
        async first<T>() {
          return (statement.get(...(params as never[])) ?? null) as T | null
        },
        async all<T>() {
          return { results: statement.all(...(params as never[])) as T[], success: true, meta: {} }
        },
        async run() {
          statement.run(...(params as never[]))
          return { success: true, meta: {} }
        },
      }
      return prepared
    },
  } as unknown as D1Database
}

async function setupDatabase() {
  process.env.PANEL_ADMIN_EMAIL = "owner@test.dev"
  process.env.PANEL_ADMIN_PASSWORD = "test-password"
  const rawDb = new Database(":memory:")
  rawDb.exec(await Bun.file(new URL("../migrations/0001_init.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0002_platform_admin.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0003_tenant_branding.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0004_session_audit_and_permissions.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0005_user_app_version.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0006_access_groups.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0007_session_audit_unique.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0008_session_audit_model_usage.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0009_provider_policy.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0010_provider_individual_credentials.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0011_resellers_and_trials.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0012_plans.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0013_user_audit_exempt.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0014_token_quotas.sql", import.meta.url)).text())
  rawDb.exec(await Bun.file(new URL("../migrations/0015_company_user_quota_and_global_providers.sql", import.meta.url)).text())

  const fakeD1 = d1From(rawDb)
  const storeInstance = d1Store(fakeD1)
  ;(globalThis as any).__env__ = { DB: fakeD1 }
  return { rawDb, fakeD1, store: storeInstance }
}

describe("Audit Exemption Feature", () => {
  let ctx: { rawDb: Database; fakeD1: D1Database; store: Store }

  beforeAll(async () => {
    ctx = await setupDatabase()
    await ctx.store.ensureSeed()
  })

  afterAll(() => {
    delete (globalThis as any).__env__
  })

  test("persists audit_exempt flag in D1 store", async () => {
    const defaultUser = await ctx.store.users.create({
      name: "Default Dev",
      email: "default@test.dev",
      role: "member",
      passwordHash: await hashPassword("pass1234"),
      mustChangePassword: false,
    })
    expect(defaultUser.auditExempt).toBe(false)

    const exemptUser = await ctx.store.users.create({
      name: "Exempt Owner",
      email: "exempt-owner@test.dev",
      role: "owner",
      passwordHash: await hashPassword("pass1234"),
      mustChangePassword: false,
      auditExempt: true,
    })
    expect(exemptUser.auditExempt).toBe(true)

    // Verify retrieval from D1
    const fetched = await ctx.store.users.findByID(exemptUser.id)
    expect(fetched?.auditExempt).toBe(true)

    // Update flag to false and verify
    await ctx.store.users.update(exemptUser.id, { auditExempt: false })
    const updated = await ctx.store.users.findByID(exemptUser.id)
    expect(updated?.auditExempt).toBe(false)

    // Restore to true
    await ctx.store.users.update(exemptUser.id, { auditExempt: true })
    const restored = await ctx.store.users.findByID(exemptUser.id)
    expect(restored?.auditExempt).toBe(true)
  })

  test("records sessions normally for non-exempt users", async () => {
    const user = await ctx.store.users.create({
      name: "Normal Employee",
      email: "employee@test.dev",
      role: "member",
      passwordHash: await hashPassword("pass1234"),
      mustChangePassword: false,
      auditExempt: false,
    })

    const payload = {
      sessionID: "sess_audited_1",
      userID: user.id,
      orgID: user.orgID,
      title: "Audited feature work",
      summary: "Implemented secure billing pipeline",
      workspace: "/projects/billing",
      tokensTotal: 1500,
      costUsd: 0.05,
      durationMs: 60000,
      messagesCount: 10,
    }

    const req = new Request("http://localhost/api/v1/sessions/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const res = await postSessionAudit({ request: req } as any)
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.ok).toBe(true)
    expect(json.session).toBeDefined()
    expect(json.session.sessionID).toBe("sess_audited_1")

    // Check DB record
    const saved = await ctx.store.sessions.findBySessionID("sess_audited_1")
    expect(saved).toBeDefined()
    expect(saved?.userID).toBe(user.id)
  })

  test("completely suppresses session audit persistence for exempt users", async () => {
    const user = await ctx.store.users.create({
      name: "Company Owner",
      email: "ceo@test.dev",
      role: "owner",
      passwordHash: await hashPassword("pass1234"),
      mustChangePassword: false,
      auditExempt: true,
    })

    const payload = {
      sessionID: "sess_exempt_secret",
      userID: user.id,
      orgID: user.orgID,
      title: "Confidential M&A Strategy",
      summary: "Executive discussion on company acquisition targets",
      workspace: "/internal/secret",
      tokensTotal: 50000,
      costUsd: 1.5,
      durationMs: 300000,
      messagesCount: 42,
    }

    const req = new Request("http://localhost/api/v1/sessions/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const res = await postSessionAudit({ request: req } as any)
    expect(res.status).toBe(200)
    const json = (await res.json()) as any
    expect(json.ok).toBe(true)
    expect(json.exempt).toBe(true)
    expect(json.session).toBeNull()

    // Assert that NO session row was written to database
    const saved = await ctx.store.sessions.findBySessionID("sess_exempt_secret")
    expect(saved).toBeUndefined()

    // Query SQLite raw table to ensure zero leakage
    const rawRows = ctx.rawDb
      .query("SELECT * FROM session_audit WHERE session_id = ?")
      .all("sess_exempt_secret")
    expect(rawRows.length).toBe(0)

    const allCeoRows = ctx.rawDb
      .query("SELECT * FROM session_audit WHERE user_id = ?")
      .all(user.id)
    expect(allCeoRows.length).toBe(0)
  })

  test("authentication and status work smoothly for exempt users", async () => {
    const rawPass = "executive-secure-pass"
    const user = await ctx.store.users.create({
      name: "CFO Executive",
      email: "cfo@test.dev",
      role: "owner",
      passwordHash: await hashPassword(rawPass),
      mustChangePassword: false,
      auditExempt: true,
    })

    // 1. Test Login endpoint
    const loginReq = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "cfo@test.dev", password: rawPass }),
    })

    const loginRes = await postLogin({ request: loginReq } as any)
    expect(loginRes.status).toBe(200)
    const loginData = (await loginRes.json()) as any
    expect(loginData.ok).toBe(true)
    expect(loginData.user.id).toBe(user.id)
    expect(loginData.user.auditExempt).toBe(true)

    // 2. Test Status endpoint
    const statusReq = new Request("http://localhost/api/v1/auth/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    })

    const statusRes = await postStatus({ request: statusReq } as any)
    expect(statusRes.status).toBe(200)
    const statusData = (await statusRes.json()) as any
    expect(statusData.ok).toBe(true)
    expect(statusData.user.auditExempt).toBe(true)
  })
})
