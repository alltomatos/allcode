import { beforeEach, describe, expect, test } from "bun:test"
import { store } from "../src/lib/store"
import { isProviderAllowed } from "../src/lib/access"
import { resolveUserAccess } from "../src/lib/user-access"

let counter = 0

async function newOrg() {
  counter += 1
  return store().org.create({ name: `Org ${counter}`, slug: `org-${counter}-${crypto.randomUUID().slice(0, 6)}` })
}

async function newUser(orgID: string) {
  counter += 1
  return store().users.create({
    orgID,
    name: `User ${counter}`,
    email: `user${counter}-${crypto.randomUUID()}@example.com`,
    role: "member",
    passwordHash: "x",
    mustChangePassword: false,
  })
}

async function seedCatalog(orgID: string, providerIDs: string[]) {
  const db = store()
  for (const providerID of providerIDs) {
    await db.providers.create({ orgID, providerID, displayName: providerID, kind: "builtin" })
  }
}

describe("provider policy integration", () => {
  beforeEach(async () => {
    await store().ensureSeed()
    counter += 1
  })

  test("tenants without a catalog stay unrestricted (backwards compatible)", async () => {
    const org = await newOrg()
    const user = await newUser(org.id)
    const resolved = await resolveUserAccess(user)
    expect(resolved.providers.restricted).toBe(false)
    expect(resolved.providers.allowed).toEqual([])
    expect(isProviderAllowed(resolved.providers, "anything")).toBe(true)
  })

  test("restricted tenants only expose catalog providers", async () => {
    const org = await newOrg()
    await seedCatalog(org.id, ["anthropic", "openai"])
    await store().org.update(org.id, { providerRestricted: true, allowLocalProviders: false })
    const user = await newUser(org.id)
    const resolved = await resolveUserAccess(user)
    expect(resolved.providers.allowed).toEqual(["anthropic", "openai"])
    expect(isProviderAllowed(resolved.providers, "anthropic")).toBe(true)
    expect(isProviderAllowed(resolved.providers, "local-only")).toBe(false)
  })

  test("group denies apply and per-user allow wins", async () => {
    const org = await newOrg()
    await seedCatalog(org.id, ["anthropic", "openai"])
    await store().org.update(org.id, { providerRestricted: true, allowLocalProviders: false })
    const user = await newUser(org.id)
    const group = await store().groups.create({ orgID: org.id, name: `group-${counter}` })
    await store().groups.setUserGroups(user.id, [group.id])
    await store().providers.setGrants("group", group.id, [
      { scope: "group", scopeID: group.id, providerID: "openai", effect: "deny" },
    ])
    await store().providers.setGrants("user", user.id, [
      { scope: "user", scopeID: user.id, providerID: "openai", effect: "allow" },
    ])

    const resolved = await resolveUserAccess(user)
    expect(isProviderAllowed(resolved.providers, "openai")).toBe(true)
    expect(isProviderAllowed(resolved.providers, "anthropic")).toBe(true)
  })

  test("deleting a catalog provider drops its grants", async () => {
    const org = await newOrg()
    await seedCatalog(org.id, ["anthropic"])
    await store().org.update(org.id, { providerRestricted: true, allowLocalProviders: false })
    const user = await newUser(org.id)
    await store().providers.setGrants("user", user.id, [
      { scope: "user", scopeID: user.id, providerID: "anthropic", effect: "deny" },
    ])
    const created = await store().providers.findByProviderID(org.id, "anthropic")
    await store().providers.remove(created!.id)

    expect(await store().providers.grants("user", user.id)).toEqual([])
    const resolved = await resolveUserAccess(user)
    expect(isProviderAllowed(resolved.providers, "anthropic")).toBe(false)
  })

  test("creates and provisions a proxy provider with endpoint and credentials", async () => {
    const org = await newOrg()
    const db = store()
    const proxy = await db.providers.create({
      orgID: org.id,
      providerID: "9router",
      displayName: "9router Gateway",
      kind: "proxy",
      baseURL: "http://127.0.0.1:20128/v1",
      apiKey: "sk-9router-secret",
      models: [{ id: "auto", name: "Auto" }],
      enabled: true,
    })
    expect(proxy.kind).toBe("proxy")
    expect(proxy.apiKey).toBe("sk-9router-secret")

    const user = await newUser(org.id)
    const resolved = await resolveUserAccess(user)
    expect(resolved.providers.provisioned).toHaveLength(1)
    expect(resolved.providers.provisioned[0].id).toBe("9router")
    expect(resolved.providers.provisioned[0].baseURL).toBe("http://127.0.0.1:20128/v1")
    expect(resolved.providers.provisioned[0].apiKey).toBe("sk-9router-secret")
  })
})
