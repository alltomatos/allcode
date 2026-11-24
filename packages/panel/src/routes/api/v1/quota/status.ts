import type { APIEvent } from "@solidjs/start"
import { loadQuotaState } from "~/lib/quota-service"
import { store } from "~/lib/store"

const cors = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
}

async function belongs(userId: string, orgId: string) {
  const user = await store().users.findByID(userId)
  return Boolean(user && user.orgID === orgId)
}

function idsFrom(event: APIEvent, url: URL) {
  return {
    userId:
      url.searchParams.get("userId") ??
      event.request.headers.get("x-allcode-user-id") ??
      undefined,
    orgId:
      url.searchParams.get("orgId") ??
      event.request.headers.get("x-allcode-org-id") ??
      undefined,
  }
}

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const { userId, orgId } = idsFrom(event, url)
    if (!userId || !orgId) {
      return new Response(JSON.stringify({ error: "userId and orgId are required" }), { status: 400, headers: cors })
    }
    if (!(await belongs(userId, orgId))) {
      return new Response(JSON.stringify({ error: "userId does not belong to orgId" }), { status: 400, headers: cors })
    }
    const quota = await loadQuotaState(orgId, userId)
    return new Response(JSON.stringify({ ok: true, quota }), { status: 200, headers: cors })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error?.message || String(error) }), {
      status: 500,
      headers: cors,
    })
  }
}

export async function POST(event: APIEvent) {
  try {
    const body = (await event.request.json().catch(() => ({}))) as { userId?: string; orgId?: string }
    const userId = body.userId ?? event.request.headers.get("x-allcode-user-id") ?? undefined
    const orgId = body.orgId ?? event.request.headers.get("x-allcode-org-id") ?? undefined
    if (!userId || !orgId) {
      return new Response(JSON.stringify({ error: "userId and orgId are required" }), { status: 400, headers: cors })
    }
    if (!(await belongs(userId, orgId))) {
      return new Response(JSON.stringify({ error: "userId does not belong to orgId" }), { status: 400, headers: cors })
    }
    const quota = await loadQuotaState(orgId, userId)
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
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-allcode-user-id, x-allcode-org-id",
    },
  })
}
