import type { APIEvent } from "@solidjs/start"
import { bindings } from "~/lib/env"

export async function GET(event: APIEvent) {
  const bucket = bindings().ASSETS_BUCKET
  if (!bucket) {
    return new Response("Storage not available", { status: 503 })
  }

  const path = event.params.path
  if (!path) {
    return new Response("Not found", { status: 404 })
  }

  const object = await bucket.get(path)
  if (!object) {
    return new Response("Asset not found", { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("etag", object.httpEtag)
  headers.set("cache-control", "public, max-age=31536000, immutable")

  return new Response(object.body, { headers })
}
