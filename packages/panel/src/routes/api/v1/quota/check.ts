import type { APIEvent } from "@solidjs/start"
import { quotaExceeded } from "~/lib/quota"
import { loadQuotaState } from "~/lib/quota-service"
import { store } from "~/lib/store"

const cors = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
}

export async function POST(event: APIEvent) {
  try {
    const body = (await event.request.json().catch(() => ({}))) as { userId?: string; orgId?: string }
    const userId = body.userId ?? event.request.headers.get("x-allcode-user-id") ?? undefined
    const orgId = body.orgId ?? event.request.headers.get("x-allcode-org-id") ?? undefined
    if (!userId || !orgId) {
      return new Response(JSON.stringify({ error: "userId and orgId are required" }), { status: 400, headers: cors })
    }

    const user = await store().users.findByID(userId)
    if (!user || user.orgID !== orgId) {
      return new Response(JSON.stringify({ error: "userId does not belong to orgId" }), { status: 400, headers: cors })
    }

    const quota = await loadQuotaState(orgId, userId)
    const exceeded = quotaExceeded(quota)
    if (exceeded) {
      return new Response(JSON.stringify({ ok: false, error: exceeded, quota }), { status: 429, headers: cors })
    }
    return new Response(JSON.stringify({ ok: true, quota }), { status: 200, headers: cors })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error?.message || String(error) }), {
      status: 500,
      headers: cors,
    })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-allcode-user-id, x-allcode-org-id",
    },
  })
}
