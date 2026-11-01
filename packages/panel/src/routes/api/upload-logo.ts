import type { APIEvent } from "@solidjs/start"
import { bindings } from "~/lib/env"
import { currentUser } from "~/lib/auth"

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp"]

export async function POST(event: APIEvent) {
  const user = await currentUser()
  if (!user || (user.role !== "owner" && user.role !== "admin" && !user.isPlatformAdmin && !user.isReseller)) {
    return new Response(JSON.stringify({ error: "Não autorizado para envio de logo" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const formData = await event.request.formData()
  const file = formData.get("file") as File | null
  if (!file || typeof file === "string") {
    return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  // Validação de tamanho (máximo 5MB)
  if (file.size > MAX_SIZE_BYTES) {
    return new Response(JSON.stringify({ error: "O tamanho da imagem não pode ultrapassar 5MB." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png"
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return new Response(
      JSON.stringify({ error: "Formato de imagem inválido. Formatos aceitos: PNG, JPG, JPEG, SVG e WEBP." }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    )
  }

  const reqOrgID = formData.get("orgId")
  const targetOrgID = typeof reqOrgID === "string" && reqOrgID.trim() ? reqOrgID.trim() : (user.orgID || "empresa")
  const key = `logos/${targetOrgID}-${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const mime = file.type || `image/${ext === "svg" ? "svg+xml" : ext}`

  const bucket = bindings().ASSETS_BUCKET
  if (!bucket) {
    // Fallback gracioso para desenvolvimento e ambientes locais sem R2 configurado
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    const url = `data:${mime};base64,${base64}`
    return new Response(JSON.stringify({ ok: true, url, key }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }

  await bucket.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: mime,
    },
  })

  // URL pública servida pelo endpoint /api/assets/[...key]
  const url = `/api/assets/${key}`

  return new Response(JSON.stringify({ ok: true, url, key }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
