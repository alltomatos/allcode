import type { APIEvent } from "@solidjs/start"
import { store } from "~/lib/store"
import { verifyPassword } from "~/lib/crypto"
import { resolveUserAccess } from "~/lib/user-access"

export async function POST(event: APIEvent) {
  try {
    let email: string | undefined
    let password: string | undefined
    let appVersion: string | undefined

    const contentType = event.request.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body = (await event.request.json()) as any
      email = body?.email
      password = body?.password
      appVersion = typeof body?.appVersion === "string" ? body.appVersion : undefined
    } else {
      const form = await event.request.formData()
      email = form.get("email") as string
      password = form.get("password") as string
      const version = form.get("appVersion")
      appVersion = typeof version === "string" ? version : undefined
    }

    appVersion = appVersion?.trim().slice(0, 40) || undefined

    email = email?.trim().toLowerCase()

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    const db = store()
    await db.ensureSeed()

    const user = await db.users.findByEmail(email)
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await db.audit.log({
        actorEmail: email,
        action: "auth.login_failed_desktop",
        result: "deny",
        targetType: "user",
      })
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    if (user.status === "suspended" || user.status === "deleted") {
      return new Response(JSON.stringify({ error: "Account is disabled. Contact your administrator." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    }

    // Busca o Tenant associado
    const tenant = await db.org.get(user.orgID)
    if (tenant.status === "suspended") {
      return new Response(JSON.stringify({ error: "Company account is suspended." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      })
    }

    await db.users.update(user.id, {
      status: "active",
      lastLoginAt: new Date().toISOString(),
      ...(appVersion ? { appVersion, appVersionAt: new Date().toISOString() } : {}),
    })

    await db.audit.log({
      orgID: user.orgID,
      actorID: user.id,
      actorEmail: user.email,
      action: "auth.login_desktop",
      result: "allow",
      targetType: "user",
      targetID: user.id,
    })

    // Retorna payload completo para o AllCode Desktop
    const resolved = await resolveUserAccess(user)
    return new Response(
      JSON.stringify({
        ok: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          permissions: {
            agentui: resolved.access.agentui,
            routines: resolved.access.routines,
            changePassword: user.canChangePassword,
          },
          access: resolved.access,
          settings: resolved.settings,
          canOpenSettings: resolved.canOpenSettings,
          defaultModel: resolved.defaultModel,
          providers: resolved.providers,
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
