import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { generatePassword, hashPassword, verifyPassword } from "../src/lib/crypto"
import { d1Store, isTrialExpired, getTrialDaysRemaining, getEffectiveOrgStatus } from "../src/lib/store"

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
  db.exec(await Bun.file(new URL("../migrations/0005_user_app_version.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0006_access_groups.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0007_session_audit_unique.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0008_session_audit_model_usage.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0009_provider_policy.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0010_provider_individual_credentials.sql", import.meta.url)).text())
  db.exec(await Bun.file(new URL("../migrations/0011_resellers_and_trials.sql", import.meta.url)).text())
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
      modelUsage: [{ providerID: "anthropic", modelID: "claude-sonnet-4-5", tokens: 1500, costUsd: 0.0045, calls: 3 }],
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

  test("upserts a session audit row by session_id as the summary evolves", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    const owner = await store.users.findByEmail("owner@test.dev")
    expect(owner).toBeTruthy()

    const base = {
      sessionID: "ses_upsert",
      userID: owner!.id,
      orgID: owner!.orgID,
      title: "First turn",
      workspace: "D:/dev/allcode",
      startedAt: new Date(Date.now() - 60000).toISOString(),
      tokensInput: 100,
      tokensOutput: 50,
      tokensReasoning: 0,
      durationMs: 1000,
      messagesCount: 2,
      modelUsage: [{ providerID: "openai", modelID: "gpt-5", tokens: 150, costUsd: 0.001, calls: 1 }],
    }

    const first = await store.sessions.create({
      ...base,
      summary: "Resumo do primeiro turno",
      tokensTotal: 150,
      costUsd: 0.001,
    })
    const second = await store.sessions.create({
      ...base,
      title: "Third turn",
      summary: "Resumo consolidado da conversa",
      endedAt: new Date().toISOString(),
      tokensTotal: 900,
      costUsd: 0.0042,
      durationMs: 45000,
      messagesCount: 8,
    })

    expect(second.id).toBe(first.id)
    const list = await store.sessions.listByUser(owner!.id)
    expect(list.length).toBe(1)
    expect(list[0]?.summary).toBe("Resumo consolidado da conversa")
    expect(list[0]?.tokensTotal).toBe(900)
    expect(list[0]?.messagesCount).toBe(8)
    expect(list[0]?.startedAt).toBe(base.startedAt)

    const orgKpis = await store.sessions.getOrgKPIs(owner!.orgID)
    expect(orgKpis.totalSessions).toBe(1)
    expect(orgKpis.totalTokens).toBe(900)

    const found = await store.sessions.findBySessionID("ses_upsert")
    expect(found?.summary).toBe("Resumo consolidado da conversa")

    const usage = await store.sessions.getUserModelUsage(owner!.id)
    expect(usage.length).toBe(1)
    expect(usage[0]?.providerID).toBe("openai")
    expect(usage[0]?.modelID).toBe("gpt-5")
    expect(usage[0]?.tokens).toBe(150)
  })

  test("admin password reset replaces the hash and forces a change on next sign-in", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    const created = await store.users.create({
      name: "Maria",
      email: "maria@test.dev",
      role: "member",
      passwordHash: await hashPassword("original-pass"),
      mustChangePassword: false,
    })

    const reset = generatePassword(16)
    await store.users.update(created.id, {
      passwordHash: await hashPassword(reset),
      mustChangePassword: true,
    })

    const updated = await store.users.findByID(created.id)
    expect(updated?.mustChangePassword).toBe(true)
    expect(await verifyPassword(reset, updated!.passwordHash)).toBe(true)
    expect(await verifyPassword("original-pass", updated!.passwordHash)).toBe(false)
  })

  test("manages custom providers with protocol and user individual credentials", async () => {
    const { store } = await setup()
    await store.ensureSeed()
    const owner = await store.users.findByEmail("owner@test.dev")
    expect(owner).toBeTruthy()

    // 1. Cria provedor com protocolo
    const provider = await store.providers.create({
      orgID: owner!.orgID,
      providerID: "anthropic-corp",
      displayName: "Anthropic Corporativo",
      kind: "custom",
      protocol: "anthropic",
      baseURL: "https://api.anthropic.com",
      models: [
        { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", enabled: true },
        { id: "claude-3-haiku", name: "Claude 3 Haiku", enabled: false },
      ],
      createdBy: owner!.id,
    })

    expect(provider.protocol).toBe("anthropic")
    expect(provider.models).toHaveLength(2)

    // 2. Busca e atualiza
    const fetched = await store.providers.findByID(provider.id)
    expect(fetched?.protocol).toBe("anthropic")

    await store.providers.update(provider.id, {
      displayName: "Claude Corporativo",
    })
    const updated = await store.providers.findByID(provider.id)
    expect(updated?.displayName).toBe("Claude Corporativo")
    expect(updated?.protocol).toBe("anthropic")

    // 3. Credenciais individuais do usuário
    await store.credentials.set(owner!.id, "anthropic-corp", "sk-ant-user-key-123")
    const creds = await store.credentials.listByUser(owner!.id)
    expect(creds).toHaveLength(1)
    expect(creds[0]?.providerID).toBe("anthropic-corp")
    expect(creds[0]?.apiKey).toBe("sk-ant-user-key-123")

    const singleCred = await store.credentials.findByUserAndProvider(owner!.id, "anthropic-corp")
    expect(singleCred?.apiKey).toBe("sk-ant-user-key-123")

    // 4. Remover credencial
    await store.credentials.remove(owner!.id, "anthropic-corp")
    const afterRemove = await store.credentials.findByUserAndProvider(owner!.id, "anthropic-corp")
    expect(afterRemove).toBeUndefined()
  })

  test("trial lifecycle: verifies status, expiration, and remaining days", async () => {
    const now = Date.now()
    const activePaidOrg = {
      id: "org-1",
      name: "Org Paga",
      slug: "org-paga",
      status: "active" as const,
      maxUsers: 10,
      ssoMode: "optional" as const,
      offlineGraceHours: 72,
      sessionMaxAgeHours: 24,
      providerRestricted: false,
      allowLocalProviders: true,
      planType: "paid" as const,
      createdAt: new Date(now).toISOString(),
    }
    expect(isTrialExpired(activePaidOrg)).toBe(false)
    expect(getTrialDaysRemaining(activePaidOrg)).toBeNull()
    expect(getEffectiveOrgStatus(activePaidOrg)).toBe("active")

    const activeTrialOrg = {
      ...activePaidOrg,
      id: "org-2",
      name: "Org Trial Ativo",
      planType: "trial" as const,
      trialEndsAt: new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 dias no futuro
    }
    expect(isTrialExpired(activeTrialOrg)).toBe(false)
    expect(getTrialDaysRemaining(activeTrialOrg)).toBe(5)
    expect(getEffectiveOrgStatus(activeTrialOrg)).toBe("trial")

    const expiredTrialOrg = {
      ...activePaidOrg,
      id: "org-3",
      name: "Org Trial Expirado",
      planType: "trial" as const,
      trialEndsAt: new Date(now - 1000).toISOString(), // expirou 1s atrás
    }
    expect(isTrialExpired(expiredTrialOrg)).toBe(true)
    expect(getTrialDaysRemaining(expiredTrialOrg)).toBe(0)
    expect(getEffectiveOrgStatus(expiredTrialOrg)).toBe("expired")

    const suspendedOrg = {
      ...activeTrialOrg,
      id: "org-4",
      status: "suspended" as const,
    }
    expect(getEffectiveOrgStatus(suspendedOrg)).toBe("suspended")
  })

  test("resellers: creates reseller, isolates tenants, and calculates stats", async () => {
    const { store } = await setup()
    await store.ensureSeed()

    // 1. Cria revendedor
    const reseller = await store.resellers.create({
      name: "Alfa Parceiro Tech",
      slug: "alfa-tech",
      contactName: "Roberto",
      contactEmail: "roberto@alfatech.com.br",
      commissionRate: 0.25,
    })
    expect(reseller.id).toBeDefined()
    expect(reseller.name).toBe("Alfa Parceiro Tech")
    expect(reseller.commissionRate).toBe(0.25)

    // 2. Busca revendedor
    const bySlug = await store.resellers.findBySlug("alfa-tech")
    expect(bySlug?.id).toBe(reseller.id)
    const byId = await store.resellers.findByID(reseller.id)
    expect(byId?.slug).toBe("alfa-tech")

    // 3. Cria empresas vinculadas ao revendedor
    const now = Date.now()
    const orgTrial = await store.org.create({
      name: "Cliente Trial da Alfa",
      slug: "cliente-trial-alfa",
      maxUsers: 5,
      contactEmail: "cliente@trial.com",
      resellerID: reseller.id,
      planType: "trial",
      trialEndsAt: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })

    const orgPaid = await store.org.create({
      name: "Cliente Pago da Alfa",
      slug: "cliente-pago-alfa",
      maxUsers: 10,
      contactEmail: "cliente@pago.com",
      resellerID: reseller.id,
      planType: "paid",
    })

    // Empresa independente (sem revendedor)
    await store.org.create({
      name: "Cliente Direto",
      slug: "cliente-direto",
      maxUsers: 20,
      planType: "paid",
    })

    // 4. Testa isolamento: listByReseller
    const alfaTenants = await store.org.listByReseller(reseller.id)
    expect(alfaTenants).toHaveLength(2)
    const ids = alfaTenants.map((t) => t.id)
    expect(ids).toContain(orgTrial.id)
    expect(ids).toContain(orgPaid.id)

    // 5. Adiciona colaboradores para validar métricas
    await store.users.create({
      orgID: orgPaid.id,
      email: "user1@pago.com",
      passwordHash: "hash",
      name: "Colaborador 1",
      role: "member",
      mustChangePassword: false,
    })
    await store.users.create({
      orgID: orgPaid.id,
      email: "user2@pago.com",
      passwordHash: "hash",
      name: "Colaborador 2",
      role: "member",
      mustChangePassword: false,
    })

    // 6. Verifica estatísticas agregadas do revendedor
    const stats = await store.resellers.stats(reseller.id)
    expect(stats.totalTenants).toBe(2)
    expect(stats.activeTenants).toBe(1) // orgPaid
    expect(stats.trialTenants).toBe(1) // orgTrial
    expect(stats.totalUsers).toBe(2)
    expect(stats.commissionRate).toBe(0.25)
    // 10 assentos contratados * 50 = 500 MRR; comissão de 25% = 125
    expect(stats.estimatedMonthlyRevenue).toBe(500)
    expect(stats.estimatedCommission).toBe(125)
  })
})
