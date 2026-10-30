import { redirect } from "@solidjs/router"
import { usePanelSession } from "./session"
import { store, type PanelUser } from "./store"

export async function currentUser(): Promise<PanelUser | undefined> {
  const session = await usePanelSession()
  const id = session.data.userID
  if (!id) return
  const db = store()
  await db.ensureSeed()
  const user = await db.users.findByID(id)
  if (!user || user.status === "suspended" || user.status === "deleted") {
    await session.clear()
    return
  }
  return user
}

export async function requireUser() {
  const user = await currentUser()
  if (!user) throw redirect("/login")
  return user
}

export async function requirePlatformAdmin() {
  const user = await requireUser()
  if (!user.isPlatformAdmin) throw redirect("/app")
  return user
}

export function canManageUsers(user: PanelUser) {
  return user.role === "owner" || user.role === "admin"
}

export function canRemoveUsers(user: PanelUser) {
  return user.role === "owner"
}

export function canManageOrganization(user: PanelUser) {
  return user.role === "owner"
}
