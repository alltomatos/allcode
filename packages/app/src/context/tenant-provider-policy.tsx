import { createEffect } from "solid-js"
import type { Config } from "@allcode/sdk/v2/client"
import { ServerConnection, useServer } from "./server"
import { useServerSync } from "./server-sync"
import { useServerProtocol } from "./server-sdk"
import { useTenantAuth, type ProviderPolicy, type ProvisionedProvider } from "./tenant-auth"

const APPLIED_STORAGE = "allcode.tenant.provider.policy.v1"
const PROVISIONED_STORAGE = "allcode.tenant.provisioned.providers.v1"

/**
 * Applies the tenant provider policy and provisions centralized proxy providers
 * (e.g. 9router, OmniRoute) directly into the local server configuration.
 *
 * 1. Centralized Provisioning: Providers provisioned by the manager are merged into
 *    `config.provider` with their baseURL, credentials and model catalog.
 * 2. Precedence and Allowlist: Materialized as `disabled_providers` and v2 deny policies
 *    so unapproved providers are refused by the server.
 * 3. Lifecycle cleanup: When provisioned providers are unassigned or on logout, only
 *    tenant-provisioned entries are removed; user's local providers remain untouched.
 */
export function TenantProviderPolicySync() {
  const serverSync = useServerSync()
  const server = useServer()
  const protocol = useServerProtocol()
  const auth = useTenantAuth()

  createEffect(() => {
    const config = serverSync().data.config
    if (!config) return

    const serverKey = server.current ? ServerConnection.key(server.current) : "local"
    const policy = auth.providerPolicy()

    // Handle logout or disabled policy: clean up previously provisioned tenant providers
    if (!policy || !auth.isLoggedIn()) {
      const previousProvisioned = readProvisioned(serverKey)
      if (previousProvisioned.length > 0 && config.provider) {
        const nextProviders: Record<string, unknown> = { ...config.provider }
        let changed = false
        for (const id of previousProvisioned) {
          if (nextProviders[id]) {
            delete nextProviders[id]
            changed = true
          }
        }
        if (changed) {
          void serverSync()
            .updateConfig({ provider: nextProviders as Config["provider"] })
            .then(() => writeProvisioned(serverKey, []))
            .catch(() => undefined)
        }
      }
      return
    }

    const known = [...serverSync().data.provider.all.keys()]
    const previousApplied = readApplied(serverKey)
    const previousProvisioned = readProvisioned(serverKey)

    // 1. Resolve provisioned providers (e.g. 9router, OmniRoute)
    const currentProvisioned = policy.provisioned ?? []
    const currentProvisionedMap = new Map(currentProvisioned.map((p) => [p.id, p]))
    const nextProviders: Record<string, unknown> = { ...(config.provider ?? {}) }
    let providersChanged = false

    // Clean up removed provisioned providers
    for (const prevId of previousProvisioned) {
      if (!currentProvisionedMap.has(prevId) && nextProviders[prevId]) {
        delete nextProviders[prevId]
        providersChanged = true
      }
    }

    // Provision or update active centralized proxy providers
    for (const p of currentProvisioned) {
      const existing = nextProviders[p.id] as Record<string, unknown> | undefined
      const desiredEntry = {
        name: p.name,
        npm: p.npm ?? "@ai-sdk/openai-compatible",
        options: {
          baseURL: p.baseURL,
          ...(p.apiKey ? { apiKey: p.apiKey } : {}),
          ...(p.headers && Object.keys(p.headers).length > 0 ? { headers: p.headers } : {}),
        },
        models: Object.fromEntries((p.models ?? []).map((m) => [m.id, { id: m.id, name: m.name }])),
      }

      if (!sameProviderConfig(existing, desiredEntry)) {
        nextProviders[p.id] = desiredEntry
        providersChanged = true
      }
    }

    // 2. Resolve allowlist / denylist
    const desired = desiredDenies(policy, known)
    const baseline = (config.disabled_providers ?? []).filter(
      (id) => !previousApplied.includes(id) && !policy.denied.includes(id),
    )
    const applied = [...new Set([...baseline, ...desired])].sort()
    const currentDisabled = [...(config.disabled_providers ?? [])].sort()
    const disabledChanged = !sameList(applied, currentDisabled)

    if (!providersChanged && !disabledChanged) return

    const patch: Config = {}
    if (disabledChanged) {
      patch.disabled_providers = applied
      if (protocol() === "v2") patch.experimental = { ...config.experimental, policies: denyPolicies(desired) }
    }
    if (providersChanged) {
      patch.provider = nextProviders as Config["provider"]
    }

    void serverSync()
      .updateConfig(patch)
      .then(() => {
        if (disabledChanged) writeApplied(serverKey, desired)
        if (providersChanged) writeProvisioned(serverKey, currentProvisioned.map((p) => p.id))
      })
      .catch(() => undefined)
  })

  return null
}

export function useProviderPolicy() {
  const auth = useTenantAuth()
  const policy = () => auth.providerPolicy()

  return {
    policy,
    canCreateCustom: () => auth.canConfigureProviders(),
    canOverrideCorporate: () => auth.canOverrideCorporate(),
    provisionedProviders: () => policy()?.provisioned ?? [],
    allows: (providerID: string) => {
      const current = policy()
      if (!current) return true
      if (current.denied.includes(providerID)) return false
      if (!current.restricted) return true
      return current.allowLocal || current.allowed.includes(providerID)
    },
  }
}

function desiredDenies(policy: ProviderPolicy, known: string[]) {
  if (!policy.restricted) return policy.denied
  if (policy.allowLocal) return policy.denied
  const allowed = new Set(policy.allowed)
  return known.filter((providerID) => !allowed.has(providerID) && !policy.denied.includes(providerID))
}

function denyPolicies(providers: string[]) {
  return providers.map((providerID) => ({
    action: "provider.use" as const,
    effect: "deny" as const,
    resource: providerID,
  }))
}

function sameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function sameProviderConfig(left: Record<string, unknown> | undefined, right: Record<string, unknown>): boolean {
  if (!left || !right) return false
  if (left.name !== right.name) return false
  if (left.npm !== right.npm) return false
  const leftOptions = (left.options ?? {}) as Record<string, unknown>
  const rightOptions = (right.options ?? {}) as Record<string, unknown>
  if (leftOptions.baseURL !== rightOptions.baseURL) return false
  if (leftOptions.apiKey !== rightOptions.apiKey) return false
  const leftModels = Object.keys((left.models ?? {}) as Record<string, unknown>).sort()
  const rightModels = Object.keys((right.models ?? {}) as Record<string, unknown>).sort()
  return sameList(leftModels, rightModels)
}

function readApplied(serverKey: string): string[] {
  try {
    const raw = localStorage.getItem(APPLIED_STORAGE)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const value = parsed[serverKey]
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function writeApplied(serverKey: string, providers: string[]) {
  try {
    const raw = localStorage.getItem(APPLIED_STORAGE)
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {}
    parsed[serverKey] = providers
    localStorage.setItem(APPLIED_STORAGE, JSON.stringify(parsed))
  } catch {
    // Persistence is best-effort; the next session recomputes from the policy.
  }
}

function readProvisioned(serverKey: string): string[] {
  try {
    const raw = localStorage.getItem(PROVISIONED_STORAGE)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const value = parsed[serverKey]
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function writeProvisioned(serverKey: string, providerIDs: string[]) {
  try {
    const raw = localStorage.getItem(PROVISIONED_STORAGE)
    const parsed: Record<string, unknown> = raw ? JSON.parse(raw) : {}
    parsed[serverKey] = providerIDs
    localStorage.setItem(PROVISIONED_STORAGE, JSON.stringify(parsed))
  } catch {
    // Best-effort cache.
  }
}
