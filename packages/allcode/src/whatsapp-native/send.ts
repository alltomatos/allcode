import type { WaClient } from "zapo-js"
import type { Proto } from "zapo-js"
import { deriveFilename, inferMimetype, mediaKindFromMimetype, type MediaKind } from "./media"

/** Referência de mensagem citada (resposta com quote). */
export interface QuoteRef {
  id: string
  participant?: string
  remoteJid?: string
}

export interface SendResult {
  messageId?: string
}

function quoteOptions(quote?: QuoteRef) {
  return quote ? { quote } : undefined
}

export async function sendText(
  client: WaClient,
  input: { to: string; text: string; quote?: QuoteRef },
): Promise<SendResult> {
  const result = await client.message.send(input.to, input.text, quoteOptions(input.quote))
  return { messageId: result?.id }
}

export async function sendMedia(
  client: WaClient,
  input: {
    to: string
    /** Caminho local, URL ou base64 (`data:` não é suportado — use caminho/URL). */
    media: string
    kind?: MediaKind
    caption?: string
    mimetype?: string
    filename?: string
    quote?: QuoteRef
  },
): Promise<SendResult> {
  const mimetype = input.mimetype ?? inferMimetype(input.media)
  const kind = input.kind ?? mediaKindFromMimetype(mimetype)
  const content = {
    type: kind === "document" ? ("document" as const) : (kind as "image" | "video" | "audio" | "sticker"),
    media: input.media,
    mimetype,
    ...(input.caption && kind !== "sticker" ? { caption: input.caption } : {}),
    ...(kind === "document"
      ? { fileName: input.filename ?? deriveFilename(input.media, kind) ?? "arquivo" }
      : {}),
  }
  const result = await client.message.send(input.to, content, quoteOptions(input.quote))
  return { messageId: result?.id }
}

export async function sendReaction(
  client: WaClient,
  input: {
    chatId: string
    messageId: string
    emoji: string
    fromMe?: boolean
    participant?: string
  },
): Promise<SendResult> {
  const result = await client.message.send(input.chatId, {
    type: "reaction",
    emoji: input.emoji,
    target: {
      remoteJid: input.chatId,
      id: input.messageId,
      fromMe: input.fromMe ?? false,
      ...(input.participant ? { participant: input.participant } : {}),
    },
  })
  return { messageId: result?.id }
}

/**
 * Envia um `Proto.IMessage` cru (botões, listas, PIX, carrossel). É o caminho
 * que o `zapo` expõe para mensagens interativas — ver `interactive.ts`.
 */
export async function sendInteractive(
  client: WaClient,
  input: { to: string; message: Proto.IMessage; quote?: QuoteRef },
): Promise<SendResult> {
  const result = await client.message.send(input.to, input.message, quoteOptions(input.quote))
  return { messageId: result?.id }
}
