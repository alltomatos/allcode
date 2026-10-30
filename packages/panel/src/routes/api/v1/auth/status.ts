import type { APIEvent } from "@solidjs/start"
import { store } from "~/lib/store"

export async function POST(event: APIEvent) {
  try {
    const body = (await event.request.json()) as { userId?: string; email?: string }
    const userId = body?.userId
    const email = body?.email?.trim().toLowerCase()

    if (!userId && !email) {
      return new Response(JSON.stringify({ error: "userId or email is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
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

    return new Response(
      JSON.stringify({
        ok: true,
        active: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          permissions: {
            agentui: user.canUseAgentUI,
            routines: user.canUseRoutines,
            changePassword: user.canChangePassword,
          },
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error?.message || String(error) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
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
