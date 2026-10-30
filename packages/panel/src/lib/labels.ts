import type { Key } from "~/i18n"
import type { Role, Status } from "./store"

export function roleKey(role: Role): Key {
  if (role === "owner") return "users.role.owner"
  if (role === "admin") return "users.role.admin"
  return "users.role.member"
}

export function statusKey(status: Status): Key {
  if (status === "invited") return "users.status.invited"
  if (status === "active") return "users.status.active"
  if (status === "suspended") return "users.status.suspended"
  return "users.status.deleted"
}

export function statusTone(status: Status) {
  if (status === "active") return "success" as const
  if (status === "invited") return "warning" as const
  if (status === "suspended") return "danger" as const
  return "neutral" as const
}

export function roleTone(role: Role) {
  if (role === "owner") return "brand" as const
  if (role === "admin") return "brand" as const
  return "neutral" as const
}

export function actionKey(action: string): Key | undefined {
  if (action === "auth.login") return "event.auth.login"
  if (action === "auth.login_failed") return "event.auth.login_failed"
  if (action === "auth.logout") return "event.auth.logout"
  if (action === "user.created") return "event.user.created"
  if (action === "user.role_changed") return "event.user.role_changed"
  if (action === "user.suspended") return "event.user.suspended"
  if (action === "user.reactivated") return "event.user.reactivated"
  if (action === "user.removed") return "event.user.removed"
  if (action === "org.updated") return "event.org.updated"
  if (action === "tenant.created") return "event.tenant.created"
  if (action === "tenant.suspended") return "event.tenant.suspended"
  if (action === "tenant.reactivated") return "event.tenant.reactivated"
  if (action === "tenant.limits_updated") return "event.tenant.limits_updated"
}

export function formatDate(value?: string, locale = "pt-BR") {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
