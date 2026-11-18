import { Database } from "bun:sqlite"
import { afterEach, describe, expect, test } from "bun:test"
import { hashPassword, verifyPassword } from "../src/lib/crypto"
import { changePassword, verifyCredentials } from "../src/lib/password-change"
import { d1Store } from "../src/lib/store"

const MIGRATIONS = [
  "0001_init.sql",
  "0002_platform_admin.sql",
  "0003_tenant_branding.sql",
  "0004_session_audit_and_permissions.sql",
  "0005_user_app_version.sql",
  "0006_access_groups.sql",
  "0007_session_audit_unique.sql",
  "0008_session_audit_model_usage.sql",
  "0009_provider_policy.sql",
  "0010_provider_individual_credentials.sql",
  "0011_resellers_and_trials.sql",
  "0012_plans.sql",
  "0013_user_audit_exempt.sql",
  "0014_token_quotas.sql",
  "0015_company_user_quota_and_global_providers.sql",
  "0016_password_updated_at.sql",
]

function d1From(db: Database, options: { loseWrites?: boolean } = {}) {
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
          if (options.loseWrites) return { success: true, meta: { changes: 0 } }
          const result = statement.run(...(params as never[]))
          return { success: true, meta: { changes: result.changes } }
        },
      }
      return prepared
    },
  } as unknown as D1Database
}

async function setup(options: { loseWrites?: boolean } = {}) {
  process.env.PANEL_ADMIN_EMAIL = "owner@test.dev"
  process.env.PANEL_ADMIN_PASSWORD = "seed-password"
  const raw = new Database(":memory:")
  for (const name of MIGRATIONS) {
    raw.exec(await Bun.file(new URL(`../migrations/${name}`, import.meta.url)).text())
  }
  const good = d1Store(d1From(raw))
  await good.ensureSeed()
  const temporaryPassword = "TempPassword!123"
  const user = await good.users.create({
    name: "Admin Geral",
    email: "admin-geral@test.dev",
    role: "owner",
    passwordHash: await hashPassword(temporaryPassword),
    mustChangePassword: true,
  })
  const store = options.loseWrites ? d1Store(d1From(raw, options)) : good
  return { raw, store, user, temporaryPassword }
}

const originalEmail = process.env.PANEL_ADMIN_EMAIL
const originalPassword = process.env.PANEL_ADMIN_PASSWORD

afterEach(() => {
  if (originalEmail === undefined) delete process.env.PANEL_ADMIN_EMAIL
  else process.env.PANEL_ADMIN_EMAIL = originalEmail
  if (originalPassword === undefined) delete process.env.PANEL_ADMIN_PASSWORD
  else process.env.PANEL_ADMIN_PASSWORD = originalPassword
})

function row(raw: Database, id: string) {
  return raw
    .query("SELECT password_hash, must_change_password, updated_at FROM panel_user WHERE id = ?")
    .get(id) as { password_hash: string; must_change_password: number; updated_at: string | null }
}

describe("troca de senha persistida no D1", () => {
  test("troca -> nova senha autentica, temporaria e rejeitada, desktop e painel concordam", async () => {
    const { raw, store, user, temporaryPassword } = await setup()
    const newPassword = "NovaSenhaForte!456"
    const before = row(raw, user.id)
    expect(before.must_change_password).toBe(1)
    expect(await verifyPassword(temporaryPassword, before.password_hash)).toBe(true)

    const result = await changePassword(store, {
      userID: user.id,
      currentPassword: temporaryPassword,
      newPassword,
    })
    expect(result.ok).toBe(true)

    const after = row(raw, user.id)
    expect(after.password_hash).not.toBe(before.password_hash)
    expect(after.must_change_password).toBe(0)
    expect(after.updated_at).toBeTruthy()
    expect(await verifyPassword(newPassword, after.password_hash)).toBe(true)
    expect(await verifyPassword(temporaryPassword, after.password_hash)).toBe(false)

    // /api/v1/auth/login (desktop) usa verifyCredentials sobre o mesmo store.
    const desktop = await verifyCredentials(store, user.email, newPassword)
    expect(desktop?.id).toBe(user.id)
    expect(await verifyCredentials(store, user.email, temporaryPassword)).toBeUndefined()

    // O login do painel usa findByEmail + verifyPassword sobre o mesmo registro.
    const panelUser = await store.users.findByEmail(user.email)
    expect(panelUser?.id).toBe(user.id)
    expect(await verifyPassword(newPassword, panelUser!.passwordHash)).toBe(true)
    expect(await verifyPassword(temporaryPassword, panelUser!.passwordHash)).toBe(false)

    const events = raw
      .query("SELECT action, result, target_id FROM audit_event WHERE action = 'auth.password_changed'")
      .all() as { action: string; result: string; target_id: string }[]
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ result: "allow", target_id: user.id })
  })

  test("senha atual incorreta nao altera o hash e gera evento deny", async () => {
    const { raw, store, user } = await setup()
    const before = row(raw, user.id)

    const result = await changePassword(store, {
      userID: user.id,
      currentPassword: "senha-errada",
      newPassword: "NovaSenhaForte!456",
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("invalid_current_password")
    expect(row(raw, user.id)).toEqual(before)
    const events = raw
      .query("SELECT action, result FROM audit_event WHERE action = 'auth.password_change_failed'")
      .all() as { action: string; result: string }[]
    expect(events).toHaveLength(1)
    expect(events[0]?.result).toBe("deny")
    expect(
      raw.query("SELECT COUNT(*) AS n FROM audit_event WHERE action = 'auth.password_changed'").get() as { n: number },
    ).toEqual({ n: 0 })
  })

  test("escrita nao confirmada lanca erro e nao registra sucesso", async () => {
    const { raw, store, user, temporaryPassword } = await setup({ loseWrites: true })
    await expect(
      changePassword(store, {
        userID: user.id,
        currentPassword: temporaryPassword,
        newPassword: "NovaSenhaForte!456",
      }),
    ).rejects.toThrow()
    expect(
      raw.query("SELECT COUNT(*) AS n FROM audit_event WHERE action = 'auth.password_changed'").get() as { n: number },
    ).toEqual({ n: 0 })
  })
})
