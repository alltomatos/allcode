import { afterEach, describe, expect, test } from "bun:test"
import { hashPassword, passwordHashIsSupported, verifyPassword } from "../src/lib/crypto"
import {
  SELECT_ADMIN_SQL,
  SELECT_LOGIN_EVENTS_SQL,
  assertSafeEmail,
  assertSafeHash,
  buildAuditStatement,
  buildResetStatement,
} from "../script/reset-admin-password"

const originalPepper = process.env.PANEL_PASSWORD_PEPPER

afterEach(() => {
  if (originalPepper === undefined) delete process.env.PANEL_PASSWORD_PEPPER
  else process.env.PANEL_PASSWORD_PEPPER = originalPepper
})

describe("hash de senha compatível com a aplicação", () => {
  test("round-trip com pepper e rejeita pepper divergente", async () => {
    process.env.PANEL_PASSWORD_PEPPER = "pepper-de-teste"
    const hash = await hashPassword("SenhaTemporaria!123")
    expect(passwordHashIsSupported(hash)).toBe(true)
    expect(hash.startsWith("pbkdf2$sha256$100000$")).toBe(true)
    expect(await verifyPassword("SenhaTemporaria!123", hash)).toBe(true)
    expect(await verifyPassword("outra-senha", hash)).toBe(false)

    process.env.PANEL_PASSWORD_PEPPER = "pepper-diferente"
    expect(await verifyPassword("SenhaTemporaria!123", hash)).toBe(false)
  })

  test("rejeita esquema de hash desconhecido", async () => {
    expect(passwordHashIsSupported("bcrypt$aaa")).toBe(false)
    expect(await verifyPassword("qualquer", "bcrypt$aaa")).toBe(false)
  })
})

describe("reset parametrizado", () => {
  test("UPDATE usa placeholders e mantém valores fora do SQL", async () => {
    process.env.PANEL_PASSWORD_PEPPER = "pepper-de-teste"
    const hash = await hashPassword("SenhaTemporaria!123")
    const statement = buildResetStatement(hash, "ronaldodavi@gmail.com")
    expect(statement.sql).toContain("password_hash = ?")
    expect(statement.sql).toContain("is_platform_admin = 1")
    expect(statement.sql).not.toContain(hash)
    expect(statement.params).toEqual([hash, "ronaldodavi@gmail.com"])
  })

  test("SELECTs de pré-flight e diagnóstico são parametrizados", () => {
    expect(SELECT_ADMIN_SQL).toContain("WHERE email = ?")
    expect(SELECT_LOGIN_EVENTS_SQL).toContain("target_id = ?")
    expect(SELECT_LOGIN_EVENTS_SQL).toContain("actor_email = ?")
    expect(SELECT_LOGIN_EVENTS_SQL).not.toContain("ronaldodavi@gmail.com")
  })

  test("auditoria registra conta, operação, operador e horário", () => {
    const statement = buildAuditStatement({
      id: "evt-1",
      orgID: "org_default",
      actorEmail: "operador@allcode.dev",
      targetID: "user-1",
      at: "2026-11-18T12:00:00.000Z",
    })
    expect(statement.sql).toContain("INSERT INTO audit_event")
    expect(statement.params).toContain("user.password_reset_breakglass")
    expect(statement.params).toContain("operador@allcode.dev")
    expect(statement.params).toContain("user-1")
    expect(statement.params).toContain("2026-11-18T12:00:00.000Z")
    expect(statement.params).toContain("allow")
  })

  test("valida e-mail e hash antes de compor o comando", () => {
    expect(assertSafeEmail("  Ronaldodavi@Example.COM ")).toBe("ronaldodavi@example.com")
    expect(() => assertSafeEmail("x' OR 1=1 --")).toThrow()
    expect(assertSafeHash("pbkdf2$sha256$100000$YWJj$ZGVm")).toBe("pbkdf2$sha256$100000$YWJj$ZGVm")
    expect(() => assertSafeHash("pbkdf2$sha256$100000$abc'; DROP TABLE panel_user;--$def")).toThrow()
    expect(() => assertSafeHash("md5$abc")).toThrow()
  })
})
