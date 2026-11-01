import {
  parseOverrides,
  resolveAccess,
  resolveCanOpenSettings,
  resolveDefaultModel,
  resolveProviderPolicy,
  settingsAccess,
  type AccessOverrides,
  type ProviderPolicy,
} from "./access"
import { store, type PanelUser } from "./store"

export type ResolvedAccess = {
  access: Record<string, boolean>
  settings: Record<string, boolean>
  canOpenSettings: boolean
  defaultModel?: { provider?: string; model?: string }
  providers: ProviderPolicy
}

/**
 * Single source of truth for what a collaborator may use. Both the desktop
 * endpoints and the portal UI read through here so the rules cannot drift.
 */
export async function resolveUserAccess(user: PanelUser): Promise<ResolvedAccess> {
  const db = store()
  const [groups, org, catalog, userCreds] = await Promise.all([
    db.groups.groupsForUser(user.id),
    db.org.get(user.orgID),
    db.providers.list(user.orgID),
    db.credentials.listByUser(user.id),
  ])
  const credsMap = new Map(userCreds.map((c) => [c.providerID, c.apiKey]))
  const [groupGrants, individualGrants] = await Promise.all([
    db.providers.grantsForScopes(
      "group",
      groups.map((group) => group.id),
    ),
    db.providers.grants("user", user.id),
  ])

  // Legacy booleans only matter when they were explicitly revoked (false);
  // their default (true) must not shadow a group denial.
  const legacy: AccessOverrides = {}
  if (!user.canUseAgentUI) legacy.agentui = false
  if (!user.canUseRoutines) legacy.routines = false

  const access = resolveAccess({
    individual: { ...legacy, ...parseOverrides(user.accessOverrides) },
    groups: groups.map((group) => parseOverrides(group.access)),
  })

  // Groups merge as a union (most permissive wins), so one restrictive group
  // must not revoke settings access granted by another.
  const canOpenSettings = resolveCanOpenSettings(user.canOpenSettings, groups)

  return {
    access,
    settings: settingsAccess(access, canOpenSettings),
    canOpenSettings,
    defaultModel: resolveDefaultModel(
      { provider: user.defaultProvider, model: user.defaultModel },
      { provider: org.defaultProvider, model: org.defaultModel },
    ),
    providers: resolveProviderPolicy({
      catalog: catalog.map((provider) => ({
        id: provider.id,
        providerID: provider.providerID,
        displayName: provider.displayName,
        kind: provider.kind,
        protocol: provider.protocol,
        npm: provider.npm,
        baseURL: provider.baseURL,
        apiKey: credsMap.get(provider.providerID) || provider.apiKey,
        models: provider.models,
        headers: provider.headers,
        env: provider.env,
        enabled: provider.enabled,
      })),
      restricted: org.providerRestricted,
      allowLocal: org.allowLocalProviders,
      groupGrants,
      individualGrants,
    }),
  }
}
