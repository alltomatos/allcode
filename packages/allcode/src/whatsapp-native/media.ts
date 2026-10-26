import path from "node:path"

/**
 * Normalização de mídia para o envio nativo.
 *
 * O `zapo` aceita caminho local, Buffer/Readable ou URL no campo `media`, mas
 * exige `mimetype` quando não há um `WaMediaProcessor` configurado. Como não
 * instalamos `@zapo-js/media-utils`, inferimos o mimetype pela extensão do
 * arquivo/URL e deixamos o usuário sobrescrever explicitamente.
 */

export type MediaKind = "image" | "video" | "audio" | "document" | "sticker"

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg; codecs=opus",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".zip": "application/zip",
}

function extensionOf(media: string): string {
  // URL com query string: tira `?`/`#` antes de olhar a extensão.
  const clean = media.split("?")[0].split("#")[0]
  return path.extname(clean).toLowerCase()
}

export function inferMimetype(media: string): string | undefined {
  return MIME_BY_EXTENSION[extensionOf(media)]
}

export function mediaKindFromMimetype(mimetype: string | undefined): MediaKind {
  if (!mimetype) return "document"
  if (mimetype.startsWith("image/")) return "image"
  if (mimetype.startsWith("video/")) return "video"
  if (mimetype.startsWith("audio/")) return "audio"
  return "document"
}

/** Nome de arquivo apresentado no WhatsApp para documentos. */
export function deriveFilename(media: string, kind: MediaKind): string | undefined {
  if (kind !== "document") return undefined
  const clean = media.split("?")[0].split("#")[0]
  const base = path.basename(clean)
  return base || undefined
}
