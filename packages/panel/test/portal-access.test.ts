import { describe, expect, test } from "bun:test"
import { canAccessPortal } from "../src/lib/portal-access"
import type { PanelUser } from "../src/lib/store"

function user(patch: Partial<PanelUser>): PanelUser {
  return {
    id: "user_test",
    orgID: "org_test",
    name: "Test",
    email: "test@test.dev",
    role: "member",
    status: "active",
    passwordHash: "",
    mustChangePassword: false,
    isPlatformAdmin: false,
    isReseller: false,
    canUseAgentUI: true,
    canUseRoutines: true,
    canChangePassword: true,
    accessOverrides: "{}",
    createdAt: new Date().toISOString(),
    ...patch,
  }
}

describe("portal access", () => {
  test("allows platform admins", () => {
    expect(canAccessPortal(user({ isPlatformAdmin: true, role: "member" }))).toBe(true)
  })

  test("allows resellers", () => {
    expect(canAccessPortal(user({ isReseller: true, role: "member" }))).toBe(true)
  })

  test("allows company owners and admins", () => {
    expect(canAccessPortal(user({ role: "owner" }))).toBe(true)
    expect(canAccessPortal(user({ role: "admin" }))).toBe(true)
  })

  test("blocks regular members", () => {
    expect(canAccessPortal(user({ role: "member" }))).toBe(false)
  })
})
