import type { APIEvent } from "@solidjs/start"
import { store } from "~/lib/store"

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
      startedAt?: string
      endedAt?: string
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
    const startedAt = body.startedAt || new Date().toISOString()

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
      endedAt: body.endedAt,
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
