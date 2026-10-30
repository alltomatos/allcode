import type { APIEvent } from "@solidjs/start"
import { store } from "~/lib/store"

function normalizeIsoDate(value: unknown): string {
  if (typeof value === "number") {
    return new Date(value).toISOString()
  }
  if (typeof value === "string") {
    const asNum = Number(value)
    if (!Number.isNaN(asNum) && asNum > 1_000_000_000_000) {
      return new Date(asNum).toISOString()
    }
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }
  return new Date().toISOString()
}

export async function POST(event: APIEvent) {
  try {
    const body = (await event.request.json()) as {
      sessionID?: string
      sessionId?: string
      userID?: string
      userId?: string
      orgID?: string
      orgId?: string
      title?: string
      summary?: string
      workspace?: string
      startedAt?: string | number
      endedAt?: string | number
      tokensTotal?: number
      tokensInput?: number
      tokensOutput?: number
      tokensReasoning?: number
      costUsd?: number
      durationMs?: number
      messagesCount?: number
    }

    const sessionID = body.sessionID || body.sessionId
    const userID = body.userID || body.userId
    const orgID = body.orgID || body.orgId
    const summary = body.summary || body.title || "Sessão de trabalho AllCode"
    const workspace = body.workspace || "Workspace local"
    const startedAt = normalizeIsoDate(body.startedAt)
    const endedAt = body.endedAt ? normalizeIsoDate(body.endedAt) : undefined

    if (!sessionID || !userID || !orgID) {
      return new Response(
        JSON.stringify({ error: "sessionID, userID and orgID are required" }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      )
    }

    const db = store()
    await db.ensureSeed()

    const sessionRecord = await db.sessions.create({
      sessionID,
      userID,
      orgID,
      title: body.title || summary.slice(0, 80),
      summary,
      workspace,
      startedAt,
      endedAt,
      tokensTotal: Math.max(0, Number(body.tokensTotal ?? 0)),
      tokensInput: Math.max(0, Number(body.tokensInput ?? 0)),
      tokensOutput: Math.max(0, Number(body.tokensOutput ?? 0)),
      tokensReasoning: Math.max(0, Number(body.tokensReasoning ?? 0)),
      costUsd: Math.max(0, Number(body.costUsd ?? 0)),
      durationMs: Math.max(0, Number(body.durationMs ?? 0)),
      messagesCount: Math.max(0, Number(body.messagesCount ?? 0)),
    })

    return new Response(JSON.stringify({ ok: true, session: sessionRecord }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "Failed to persist session audit", details: error?.message || String(error) }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
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
