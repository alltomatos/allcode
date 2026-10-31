import type { APIEvent } from "@solidjs/start"
import { store } from "~/lib/store"
import { hashPassword, verifyPassword } from "~/lib/crypto"

const MIN_PASSWORD_LENGTH = 8

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  })
}

export async function POST(event: APIEvent) {
  try {
    const body = (await event.request.json()) as {
      userId?: string
      userID?: string
      orgId?: string
      orgID?: string
      currentPassword?: string
      newPassword?: string
    }

    const userID = body.userId || body.userID
    const currentPassword = body.currentPassword ?? ""
    const newPassword = body.newPassword ?? ""

    if (!userID || !currentPassword || !newPassword) {
      return json({ ok: false, error: "missing_fields", message: "userId, currentPassword and newPassword are required." }, 400)
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return json(
        {
          ok: false,
          error: "password_too_short",
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
          minLength: MIN_PASSWORD_LENGTH,
        },
        400,
      )
    }

    if (newPassword === currentPassword) {
      return json(
        { ok: false, error: "password_unchanged", message: "New password must differ from the current one." },
        400,
      )
    }

    const db = store()
    await db.ensureSeed()

    const user = await db.users.findByID(userID)
    if (!user || user.status === "deleted") {
      return json({ ok: false, error: "account_removed", message: "Account has been removed." }, 403)
    }

    if (user.status === "suspended") {
      return json({ ok: false, error: "account_suspended", message: "Account is suspended." }, 403)
    }

    const tenant = await db.org.get(user.orgID)
    if (tenant.status === "suspended") {
      return json({ ok: false, error: "tenant_suspended", message: "Company account is suspended." }, 403)
    }

    if (!user.canChangePassword) {
      return json(
        { ok: false, error: "password_change_disabled", message: "Password changes are disabled for this account." },
        403,
      )
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
      return json({ ok: false, error: "invalid_current_password", message: "Current password is incorrect." }, 401)
    }

    await db.users.update(user.id, {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    })

    await db.audit.log({
      orgID: user.orgID,
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.password_changed",
      result: "allow",
      targetType: "user",
      targetID: user.id,
    })

    return json({ ok: true })
  } catch (error: any) {
    return json(
      { ok: false, error: "internal_error", message: error?.message || String(error) },
      500,
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  })
}
