import type { PanelUser } from "./store"

/**
 * Only platform admins, resellers and company administrators may use the
 * management portal. Regular collaborators authenticate through the desktop app.
 */
export function canAccessPortal(user: PanelUser) {
  return Boolean(
    user.isPlatformAdmin || user.isReseller || user.role === "owner" || user.role === "admin",
  )
}
