import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { d1Store } from "../src/lib/store"

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

async function setup() {
  process.env.PANEL_ADMIN_EMAIL = "owner@test.dev"
  process.env.PANEL_ADMIN_PASSWORD = "test-password"
  const db = new Database(":memory:")
  db.exec(await Bun.file(new URL("../migrations/0001_init.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0002_platform_admin.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0003_tenant_branding.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0004_session_audit_and_permissions.sql", import.meta.url)).text())
  return { raw: db, store: d1Store(d1From(db)) }
}

describe("D1 store", () => {
  test("seeds the organization and the owner once", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    await store.ensureSeed()
    const owner = await store.users.findByEmail("owner@test.dev")
    expect(owner?.role).toBe("owner")
    expect(owner?.status).toBe("active")
    expect((await store.users.count()).total).toBe(1)
    expect((await store.org.get()).slug).toBe("allcode-demo")
  })

  test("creates, updates and counts users", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    const created = await store.users.create({
      name: "Maria",
      email: "maria@test.dev",
      role: "member",
      passwordHash: "hash",
      mustChangePassword: true,
    })
    expect(created.status).toBe("invited")

    let counts = await store.users.count()
    expect(counts.total).toBe(2)
    expect(counts.invited).toBe(1)

    await store.users.update(created.id, { status: "active", role: "admin" })
    const updated = await store.users.findByID(created.id)
    expect(updated?.role).toBe("admin")
    expect(updated?.status).toBe("active")

    counts = await store.users.count()
    expect(counts.active).toBe(2)

    await store.users.update(created.id, { status: "deleted" })
    expect(await store.users.findByID(created.id)).toMatchObject({ status: "deleted" })
    expect((await store.users.list()).length).toBe(1)
    expect((await store.users.count()).total).toBe(1)
  })

  test("records and filters audit events", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    const event = await store.audit.log({
      actorEmail: "owner@test.dev",
      action: "user.created",
      result: "allow",
      targetType: "user",
      targetID: "user_1",
    })
    await store.audit.log({ actorEmail: "owner@test.dev", action: "auth.login", result: "allow" })

    expect((await store.audit.list()).length).toBe(2)
    const forTarget = await store.audit.forTarget("user_1")
    expect(forTarget.length).toBe(1)
    expect(forTarget[0]?.id).toBe(event.id)
  })

  test("updates organization policy", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    const updated = await store.org.update("org_default", {
      name: "Acme",
      ssoMode: "required",
      offlineGraceHours: 24,
      sessionMaxAgeHours: 8,
    })
    expect(updated.name).toBe("Acme")
    expect(updated.ssoMode).toBe("required")
    expect((await store.org.get("org_default")).offlineGraceHours).toBe(24)
  })

  test("records sessions and computes KPIs", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    const owner = await store.users.findByEmail("owner@test.dev")
    expect(owner).toBeTruthy()

    const session = await store.sessions.create({
      sessionID: "ses_123",
      userID: owner!.id,
      orgID: owner!.orgID,
      title: "Refactor auth pipeline",
      summary: "Refactored JWT validation and added unit tests",
      workspace: "D:/dev/allcode",
      startedAt: new Date(Date.now() - 60000).toISOString(),
      endedAt: new Date().toISOString(),
      tokensTotal: 1500,
      tokensInput: 1000,
      tokensOutput: 500,
      tokensReasoning: 0,
      costUsd: 0.0045,
      durationMs: 60000,
      messagesCount: 12,
    })
    expect(session.id).toBeDefined()

    const list = await store.sessions.listByUser(owner!.id)
    expect(list.length).toBe(1)
    expect(list[0]?.summary).toBe("Refactored JWT validation and added unit tests")

    const kpis = await store.sessions.getUserKPIs(owner!.id)
    expect(kpis.totalSessions).toBe(1)
    expect(kpis.totalTokens).toBe(1500)
    expect(kpis.totalCostUsd).toBeCloseTo(0.0045, 4)
    expect(kpis.totalDurationMs).toBe(60000)
  })
})
