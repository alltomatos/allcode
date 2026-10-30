import type { APIEvent } from "@solidjs/start"
import { bindings } from "~/lib/env"
import { currentUser } from "~/lib/auth"

export async function POST(event: APIEvent) {
  const user = await currentUser()
  if (!user || (user.role !== "owner" && !user.isPlatformAdmin)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const bucket = bindings().ASSETS_BUCKET
  if (!bucket) {
    return new Response(JSON.stringify({ error: "Storage not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }

  const formData = await event.request.formData()
  const file = formData.get("file") as File | null
  if (!file || typeof file === "string") {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png"
  if (!["png", "jpg", "jpeg", "svg", "webp"].includes(ext)) {
    return new Response(JSON.stringify({ error: "Invalid image format. Allowed: PNG, JPG, SVG, WEBP" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const orgID = user.orgID
  const key = `logos/${orgID}-${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  await bucket.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || `image/${ext === "svg" ? "svg+xml" : ext}`,
    },
  })

  // URL pública servida pelo endpoint /api/assets/[...key]
  const url = `/api/assets/${key}`

  return new Response(JSON.stringify({ ok: true, url, key }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
