import type { APIEvent } from "@solidjs/start"
import { store, isTrialExpired, getTrialDaysRemaining } from "~/lib/store"
import { resolveUserAccess } from "~/lib/user-access"

async function resolveStatus(userId?: string, email?: string, appVersion?: string) {
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
        error: "A conta da empresa está suspensa.",
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

  if (isTrialExpired(tenant)) {
    return new Response(
      JSON.stringify({
        ok: false,
        active: false,
        status: "trial_expired",
        reason: "trial_expired",
        error: "O período de avaliação desta empresa expirou. Entre em contato para reativação do plano.",
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

  const resolved = await resolveUserAccess(user)
  const plan = tenant.planID ? await db.plans.findByID(tenant.planID) : undefined
  const permissions = {
    agentui: resolved.access.agentui,
    routines: resolved.access.routines,
    changePassword: user.canChangePassword,
  }

  const version = appVersion?.trim().slice(0, 40)
  if (version && version !== user.appVersion) {
    await db.users.update(user.id, { appVersion: version, appVersionAt: new Date().toISOString() })
  }

  return new Response(
    JSON.stringify({
      ok: true,
      active: true,
      status: user.status,
      permissions,
      access: resolved.access,
      settings: resolved.settings,
      canOpenSettings: resolved.canOpenSettings,
      defaultModel: resolved.defaultModel,
      providers: resolved.providers,
      appVersion: version ?? user.appVersion,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        auditExempt: Boolean(user.auditExempt),
        permissions,
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
        maxUsers: tenant.maxUsers,
        planType: tenant.planType,
        trialEndsAt: tenant.trialEndsAt ?? null,
        isTrial: tenant.planType === "trial",
        trialDaysRemaining: getTrialDaysRemaining(tenant),
        plan: plan
          ? {
              id: plan.id,
              name: plan.name,
              pricingMode: plan.pricingMode,
              priceCents: plan.priceCents,
            }
          : null,
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
    const appVersion = url.searchParams.get("appVersion") || undefined
    return await resolveStatus(userId, email, appVersion)
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
    const body = (await event.request.json()) as { userId?: string; email?: string; appVersion?: string }
    const userId = body?.userId
    const email = body?.email?.trim().toLowerCase()
    return await resolveStatus(userId, email, body?.appVersion)
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
