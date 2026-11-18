import type { APIEvent } from "@solidjs/start"
import { store } from "~/lib/store"
import { changePassword } from "~/lib/password-change"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
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

    const result = await changePassword(store(), {
      userID: body.userId || body.userID || "",
      currentPassword: body.currentPassword ?? "",
      newPassword: body.newPassword ?? "",
    })

    if (!result.ok) {
      const { ok: _ok, status, ...payload } = result
      return json(payload, status)
    }
    return json({ ok: true })
  } catch (error) {
    return json(
      { ok: false, error: "internal_error", message: error instanceof Error ? error.message : String(error) },
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
