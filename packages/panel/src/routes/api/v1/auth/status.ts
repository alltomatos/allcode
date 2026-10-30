import type { APIEvent } from "@solidjs/start"
import { store } from "~/lib/store"

async function resolveStatus(userId?: string, email?: string) {
  if (!userId && !email) {
    return new Response(JSON.stringify({ error: "userId or email is required" }), {
      status: 400,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    })
  }

  const db = store()
  await db.ensureSeed()

  const user = userId ? await db.users.findByID(userId) : await db.users.findByEmail(email!)

  if (!user || user.status === "deleted") {
    return new Response(
      JSON.stringify({
        ok: false,
        active: false,
        status: "deleted",
        reason: "deleted",
        error: "Account has been removed.",
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      },
    )
  }

  if (user.status === "suspended") {
    return new Response(
      JSON.stringify({
        ok: false,
        active: false,
        status: "suspended",
        reason: "suspended",
        error: "Account is suspended. Contact your organization administrator.",
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      },
    )
  }

  const tenant = await db.org.get(user.orgID)
  if (tenant.status === "suspended") {
    return new Response(
      JSON.stringify({
        ok: false,
        active: false,
        status: "suspended",
        reason: "tenant_suspended",
        error: "Company account is suspended.",
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      },
    )
  }

  const permissions = {
    agentui: user.canUseAgentUI,
    routines: user.canUseRoutines,
    changePassword: user.canChangePassword,
  }

  return new Response(
    JSON.stringify({
      ok: true,
      active: true,
      status: user.status,
      permissions,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        permissions,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logoUrl: tenant.logoUrl ?? null,
        welcomeMessage: tenant.welcomeMessage ?? null,
        brandColor: tenant.brandColor ?? "#10b981",
        offlineGraceHours: tenant.offlineGraceHours,
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    },
  )
}

export async function GET(event: APIEvent) {
  try {
    const url = new URL(event.request.url)
    const userId = url.searchParams.get("userId") || undefined
    const email = url.searchParams.get("email")?.trim().toLowerCase() || undefined
    return await resolveStatus(userId, email)
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error?.message || String(error) }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    })
  }
}

export async function POST(event: APIEvent) {
  try {
    const body = (await event.request.json()) as { userId?: string; email?: string }
    const userId = body?.userId
    const email = body?.email?.trim().toLowerCase()
    return await resolveStatus(userId, email)
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error?.message || String(error) }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  })
}
