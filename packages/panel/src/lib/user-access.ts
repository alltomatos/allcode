import {
  parseOverrides,
  resolveAccess,
  resolveCanOpenSettings,
  resolveDefaultModel,
  settingsAccess,
  type AccessOverrides,
} from "./access"
import { store, type PanelUser } from "./store"

export type ResolvedAccess = {
  access: Record<string, boolean>
  settings: Record<string, boolean>
  canOpenSettings: boolean
  defaultModel?: { provider?: string; model?: string }
}

/**
 * Single source of truth for what a collaborator may use. Both the desktop
 * endpoints and the portal UI read through here so the rules cannot drift.
 */
export async function resolveUserAccess(user: PanelUser): Promise<ResolvedAccess> {
  const db = store()
  const [groups, org] = await Promise.all([db.groups.groupsForUser(user.id), db.org.get(user.orgID)])

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
  }
}
