import path from "node:path"
import type { Proto } from "zapo-js"
import { Duration, Effect } from "effect"

/**
 * Processamento de mídia recebida no WhatsApp nativo.
 *
 * O inbound do zapo entrega o proto da mensagem, não o conteúdo. Áudio precisa
 * ser baixado e transcrito; documentos precisam ser extraídos para texto
 * (planilhas como dados, PDF como texto); imagens são disponibilizadas como
 * anexo multimodal. Qualquer falha é convertida em texto explícito para o
 * agente — o processamento nunca derruba a mensagem seguinte.
 */

export type InboundMediaKind = "audio" | "image" | "video" | "document" | "sticker"

export interface InboundMediaDescriptor {
  readonly kind: InboundMediaKind
  readonly mime: string
  readonly filename: string
  readonly caption?: string
  readonly metadata: Readonly<Record<string, string | number | undefined>>
}

export interface PromptAttachment {
  readonly filename?: string
  readonly mime: string
  readonly url: string
}

export interface ProcessedMedia {
  readonly text: string
  readonly attachments: readonly PromptAttachment[]
}

export interface MediaProcessors {
  readonly transcribe: (input: {
    bytes: Uint8Array
    mime: string
    filename: string
  }) => Effect.Effect<string, unknown>
}

const MAX_INLINE_BYTES = 5 * 1024 * 1024
const MAX_AUDIO_INLINE_BYTES = 10 * 1024 * 1024
const MAX_CONTENT_CHARS = 16_000
const MAX_SHEETS = 10
const MAX_SHEET_ROWS = 200
const MAX_PDF_PAGES = 50
const MAX_ZIP_ENTRIES = 20

/**
 * Mensagens de mídia/documento podem vir embrulhadas (view-once, efêmera,
 * documento com legenda). Desembrulha antes de procurar o campo real.
 */
export function unwrapMessage(message: Proto.IMessage | null | undefined): Proto.IMessage | undefined {
  let current = message ?? undefined
  for (let depth = 0; depth < 3 && current; depth++) {
    const next =
      current.ephemeralMessage?.message ??
      current.viewOnceMessage?.message ??
      current.viewOnceMessageV2?.message ??
      current.viewOnceMessageV2Extension?.message ??
      current.documentWithCaptionMessage?.message
    if (!next) return current
    current = next
  }
  return current
}

export function describeMedia(message: Proto.IMessage | null | undefined): InboundMediaDescriptor | undefined {
  const msg = unwrapMessage(message)
  if (!msg) return undefined

  const audio = msg.audioMessage
  if (audio) {
    return {
      kind: "audio",
      mime: audio.mimetype || "audio/ogg",
      filename: `audio-${Date.now()}.ogg`,
      metadata: {
        voz: audio.ptt ? "sim" : "não",
        duracao_segundos: audio.seconds ?? undefined,
      },
    }
  }

  const image = msg.imageMessage
  if (image) {
    return {
      kind: "image",
      mime: image.mimetype || "image/jpeg",
      filename: `imagem-${Date.now()}.${extensionForMimetype(image.mimetype || "image/jpeg")}`,
      caption: image.caption ?? undefined,
      metadata: {
        largura: image.width ?? undefined,
        altura: image.height ?? undefined,
      },
    }
  }

  const sticker = msg.stickerMessage
  if (sticker) {
    return {
      kind: "sticker",
      mime: sticker.mimetype || "image/webp",
      filename: `figurinha-${Date.now()}.webp`,
      metadata: { animada: sticker.isAnimated ? "sim" : "não" },
    }
  }

  const video = msg.videoMessage
  if (video) {
    return {
      kind: "video",
      mime: video.mimetype || "video/mp4",
      filename: `video-${Date.now()}.${extensionForMimetype(video.mimetype || "video/mp4")}`,
      caption: video.caption ?? undefined,
      metadata: {
        largura: video.width ?? undefined,
        altura: video.height ?? undefined,
        duracao_segundos: video.seconds ?? undefined,
      },
    }
  }

  const document = msg.documentMessage
  if (document) {
    const filename =
      document.fileName ||
      document.title ||
      `documento-${Date.now()}.${extensionForMimetype(document.mimetype || "application/octet-stream")}`
    return {
      kind: "document",
      mime: document.mimetype || inferMimeFromFilename(filename) || "application/octet-stream",
      filename,
      caption: document.caption ?? undefined,
      metadata: {},
    }
  }

  return undefined
}

/** Converte qualquer falha de download em contexto explícito para o agente. */
export function failedMedia(descriptor: InboundMediaDescriptor, reason: string): ProcessedMedia {
  return {
    text: `${header(descriptor, 0)}\nFalha ao obter o conteúdo deste anexo (${reason}). Avise o usuário que não foi possível ler este arquivo; o restante da conversa continua disponível.`,
    attachments: [],
  }
}

export function processMedia(input: {
  descriptor: InboundMediaDescriptor
  bytes: Uint8Array
  processors: MediaProcessors
}): Effect.Effect<ProcessedMedia> {
  const { descriptor, bytes, processors } = input
  const head = header(descriptor, bytes.byteLength)

  if (descriptor.kind === "audio") {
    // O áudio é sempre anexado: modelos com suporte a voz/áudio ouvem o
    // arquivo direto (AgentUI filtra pela capability do modelo). A transcrição
    // é apenas um bônus para modelos que não ouvem áudio.
    const attachments =
      bytes.byteLength <= MAX_AUDIO_INLINE_BYTES
        ? [{ filename: descriptor.filename, mime: descriptor.mime, url: dataUrl(descriptor.mime, bytes) }]
        : []
    return processors
      .transcribe({ bytes, mime: descriptor.mime, filename: descriptor.filename })
      .pipe(
        Effect.timeoutOrElse({
          duration: Duration.seconds(15),
          orElse: () => Effect.fail(new Error("transcrição indisponível")),
        }),
        Effect.map((transcript) => ({
          text: `${head}\nTranscrição do áudio:\n${transcript.trim() || "(transcrição vazia)"}`,
          attachments,
        })),
        Effect.catch((error) =>
          Effect.logWarning(`[WhatsApp Media] transcrição indisponível para ${descriptor.filename}: ${errorMessage(error)}`).pipe(
            Effect.as({
              text: `${head}\nÁudio disponibilizado para análise pelo modelo.`,
              attachments,
            }),
          ),
        ),
      )
  }

  if (descriptor.kind === "image" || descriptor.kind === "sticker") {
    const caption = captionLine(descriptor)
    if (descriptor.mime === "image/svg+xml" || descriptor.filename.toLowerCase().endsWith(".svg")) {
      return Effect.sync(() => ({
        text: `${head}${caption}\nSVG recebido (conteúdo textual):\n${truncate(decodeUtf8(bytes))}`,
        attachments: [],
      }))
    }
    if (bytes.byteLength > MAX_INLINE_BYTES) {
      return Effect.succeed({
        text: `${head}${caption}\nImagem grande demais para ser anexada ao modelo (${formatBytes(bytes.byteLength)}); use os metadados para responder.`,
        attachments: [],
      })
    }
    return Effect.succeed({
      text: `${head}${caption}\nImagem disponibilizada para análise.`,
      attachments: [{ filename: descriptor.filename, mime: descriptor.mime, url: dataUrl(descriptor.mime, bytes) }],
    })
  }

  if (descriptor.kind === "document") {
    return extractDocument(descriptor, bytes).pipe(
      Effect.map((extracted) => {
        const caption = captionLine(descriptor)
        if (!extracted.text.trim()) {
          const attachPdf =
            descriptor.mime === "application/pdf" && bytes.byteLength <= MAX_INLINE_BYTES
              ? [
                  {
                    filename: descriptor.filename,
                    mime: descriptor.mime,
                    url: dataUrl(descriptor.mime, bytes),
                  },
                ]
              : []
          return {
            text: `${head}${caption}\n${extracted.note ?? "Conteúdo textual não extraído deste formato."}`,
            attachments: attachPdf,
          }
        }
        return {
          text: `${head}${caption}\n${extracted.note ? `${extracted.note}\n` : ""}Conteúdo extraído:\n${truncate(extracted.text)}`,
          attachments: [],
        }
      }),
      Effect.catch((error) =>
        Effect.logWarning(
          `[WhatsApp Media] falha na extração de ${descriptor.filename}: ${errorMessage(error)}`,
        ).pipe(Effect.as(failedMedia(descriptor, `falha na extração do documento: ${errorMessage(error)}`))),
      ),
    )
  }

  return Effect.succeed({
    text: `${head}${captionLine(descriptor)}\nConteúdo audiovisual não é extraído diretamente. Use os metadados acima e, se necessário, peça ao usuário mais detalhes ou o envio de um documento/imagem.`,
    attachments: [],
  })
}

interface ExtractedDocument {
  readonly text: string
  readonly note?: string
}

function extractDocument(
  descriptor: InboundMediaDescriptor,
  bytes: Uint8Array,
): Effect.Effect<ExtractedDocument, unknown> {
  return Effect.tryPromise({
    try: async () => {
      const ext = path.extname(descriptor.filename).toLowerCase() || extensionFromMime(descriptor.mime)
      const mime = descriptor.mime.toLowerCase()

      if (ext === ".pdf" || mime === "application/pdf") return extractPdf(bytes)
      if (ext === ".xlsx" || ext === ".xls" || mime.includes("spreadsheet") || mime.includes("ms-excel")) {
        return await extractWorkbook(bytes, descriptor.filename)
      }
      if (ext === ".docx") return extractZipXml(bytes, (name) => name === "word/document.xml")
      if (ext === ".odt") return extractZipXml(bytes, (name) => name === "content.xml")
      if (ext === ".pptx") {
        let index = 0
        return extractZipXml(bytes, (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name), {
          label: (name) => `Slide ${(index += 1)} (${name})`,
        })
      }
      if (isTextLike(ext, mime)) {
        const text = decodeUtf8(bytes)
        return { text: ext === ".html" || ext === ".htm" ? stripHtml(text) : text }
      }
      return { text: "", note: `Formato ${descriptor.mime} recebido, mas sem extrator de conteúdo para este tipo.` }
    },
    catch: (error) => error,
  })
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractedDocument> {
  const { extractText, getDocumentProxy } = await import("unpdf")
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  const pages = Math.min(totalPages, MAX_PDF_PAGES)
  return {
    text: String(text),
    note: totalPages > MAX_PDF_PAGES ? `PDF com ${totalPages} páginas; considerado até a página ${pages}.` : undefined,
  }
}

async function extractWorkbook(bytes: Uint8Array, filename: string): Promise<ExtractedDocument> {
  const xlsx = await import("xlsx")
  const workbook = xlsx.read(bytes, { type: "buffer", cellDates: false })
  const parts: string[] = []
  for (const name of workbook.SheetNames.slice(0, MAX_SHEETS)) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    const csv = xlsx.utils.sheet_to_csv(sheet, { blankrows: false })
    const rows = csv.split(/\r?\n/)
    const limited = rows.slice(0, MAX_SHEET_ROWS).join("\n")
    parts.push(`### Aba: ${name}${rows.length > MAX_SHEET_ROWS ? ` (primeiras ${MAX_SHEET_ROWS} linhas)` : ""}\n${limited}`)
  }
  return {
    text: parts.join("\n\n"),
    note: `Planilha "${filename}" com ${workbook.SheetNames.length} aba(s), lida como dados estruturados (CSV por aba).`,
  }
}

async function extractZipXml(
  bytes: Uint8Array,
  match: (name: string) => boolean,
  options?: { label?: (name: string) => string },
): Promise<ExtractedDocument> {
  const { BlobReader, TextWriter, ZipReader } = await import("@zip.js/zip.js")
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const zip = new ZipReader(new BlobReader(new Blob([data])))
  try {
    const entries = (await zip.getEntries()).filter((entry) => match(entry.filename)).slice(0, MAX_ZIP_ENTRIES)
    const parts: string[] = []
    for (const entry of entries) {
      const read = (entry as { getData?: (writer: InstanceType<typeof TextWriter>) => Promise<string> }).getData
      if (!read) continue
      const xml = await read.call(entry, new TextWriter())
      const text = decodeXmlText(xml)
      if (!text.trim()) continue
      parts.push(`${options?.label ? `${options.label(entry.filename)}\n` : ""}${text}`)
    }
    return { text: parts.join("\n\n") }
  } finally {
    await zip.close()
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8").decode(bytes)
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function decodeXmlText(xml: string): string {
  return xml
    .replace(/<\/(w:p|a:p|text:p|text:h)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function isTextLike(ext: string, mime: string): boolean {
  if (mime.startsWith("text/")) return true
  if (mime.includes("json") || mime.includes("xml") || mime.includes("csv")) return true
  return [
    ".csv",
    ".tsv",
    ".txt",
    ".md",
    ".json",
    ".xml",
    ".html",
    ".htm",
    ".yaml",
    ".yml",
    ".log",
    ".ini",
    ".conf",
    ".sql",
  ].includes(ext)
}

function header(descriptor: InboundMediaDescriptor, size: number): string {
  const labels: Record<InboundMediaKind, string> = {
    audio: descriptor.metadata.voz === "sim" ? "Mensagem de voz" : "Áudio",
    image: "Imagem",
    sticker: "Figurinha",
    video: "Vídeo",
    document: "Documento",
  }
  const meta = Object.entries(descriptor.metadata)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")
  return `[${labels[descriptor.kind]} recebido: ${descriptor.filename}, ${descriptor.mime}${size > 0 ? `, ${formatBytes(size)}` : ""}${meta ? `, ${meta}` : ""}]`
}

function captionLine(descriptor: InboundMediaDescriptor): string {
  return descriptor.caption?.trim() ? `\nLegenda/descrição enviada pelo usuário: ${descriptor.caption.trim()}` : ""
}

function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`
}

function truncate(text: string): string {
  if (text.length <= MAX_CONTENT_CHARS) return text
  return `${text.slice(0, MAX_CONTENT_CHARS)}\n[...conteúdo truncado em ${MAX_CONTENT_CHARS} caracteres]`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionForMimetype(mime: string): string {
  return (
    {
      "audio/ogg": "ogg",
      "audio/ogg; codecs=opus": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/wav": "wav",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
      "application/pdf": "pdf",
    } as Record<string, string>
  )[mime] ?? "bin"
}

function extensionFromMime(mime: string): string {
  const ext = extensionForMimetype(mime)
  return ext === "bin" ? "" : `.${ext}`
}

function inferMimeFromFilename(filename: string): string | undefined {
  const ext = path.extname(filename).toLowerCase()
  return (
    {
      ".pdf": "application/pdf",
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".csv": "text/csv",
      ".txt": "text/plain",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    } as Record<string, string>
  )[ext]
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
