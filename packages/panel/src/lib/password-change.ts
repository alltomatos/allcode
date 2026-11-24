import { hashPassword, verifyPassword } from "./crypto"
import type { PanelUser, Store } from "./store"

const MIN_PASSWORD_LENGTH = 8

type Failure = {
  ok: false
  status: number
  error: string
  message: string
  minLength?: number
}

export type PasswordChangeResult = { ok: true; user: PanelUser } | Failure

function fail(status: number, error: string, message: string, minLength?: number): Failure {
  return { ok: false, status, error, message, ...(minLength ? { minLength } : {}) }
}

export async function verifyCredentials(db: Store, email: string, password: string): Promise<PanelUser | undefined> {
  const user = await db.users.findByEmail(email.trim().toLowerCase())
  if (!user || !(await verifyPassword(password, user.passwordHash))) return
  return user
}

export async function changePassword(
  db: Store,
  input: { userID: string; currentPassword: string; newPassword: string },
): Promise<PasswordChangeResult> {
  const { userID } = input
  const currentPassword = input.currentPassword ?? ""
  const newPassword = input.newPassword ?? ""

  if (!userID || !currentPassword || !newPassword) {
    return fail(400, "missing_fields", "userId, currentPassword and newPassword are required.")
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return fail(
      400,
      "password_too_short",
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      MIN_PASSWORD_LENGTH,
    )
  }
  if (newPassword === currentPassword) {
    return fail(400, "password_unchanged", "New password must differ from the current one.")
  }

  await db.ensureSeed()

  const user = await db.users.findByID(userID)
  if (!user || user.status === "deleted") return fail(403, "account_removed", "Account has been removed.")
  if (user.status === "suspended") return fail(403, "account_suspended", "Account is suspended.")

  const tenant = await db.org.get(user.orgID)
  if (tenant.status === "suspended") return fail(403, "tenant_suspended", "Company account is suspended.")
  if (!user.canChangePassword) {
    return fail(403, "password_change_disabled", "Password changes are disabled for this account.")
  }

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    await db.audit.log({
      orgID: user.orgID,
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.password_change_failed",
      result: "deny",
      targetType: "user",
      targetID: user.id,
    })
    return fail(401, "invalid_current_password", "Current password is incorrect.")
  }

  const nextHash = await hashPassword(newPassword)
  await db.users.update(user.id, { passwordHash: nextHash, mustChangePassword: false })

  const persisted = await db.users.findByID(user.id)
  if (!persisted || persisted.passwordHash !== nextHash || persisted.mustChangePassword) {
    throw new Error("A troca de senha não foi persistida; nenhum evento de sucesso será registrado.")
  }
  if (!(await verifyPassword(newPassword, persisted.passwordHash))) {
    throw new Error("O hash persistido não confere com a nova senha.")
  }
  if (await verifyPassword(currentPassword, persisted.passwordHash)) {
    throw new Error("A senha anterior continua válida após a troca.")
  }

  await db.audit.log({
    orgID: user.orgID,
    actorID: user.id,
    actorEmail: user.email,
    action: "auth.password_changed",
    result: "allow",
    targetType: "user",
    targetID: user.id,
  })

  return { ok: true, user: persisted }
}
