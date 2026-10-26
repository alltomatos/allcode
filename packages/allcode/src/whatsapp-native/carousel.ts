import type { Proto, WaClient } from "zapo-js"
import { carouselMessage, type CarouselCardInput } from "./interactive"
import { inferMimetype } from "./media"
import type { QuoteRef, SendResult } from "./send"

/**
 * Carrossel de verdade: cada card precisa de mídia própria no header.
 *
 * O builder puro (`interactive.carouselMessage`) recebe a mídia já convertida
 * em proto. Aqui fazemos o trabalho que depende de I/O:
 *   1. resolve a mídia (caminho local ou URL http(s));
 *   2. envia ao CDN com `client.message.upload` (o mesmo caminho de um envio
 *      de imagem normal);
 *   3. monta o `imageMessage` do header com os campos retornados pelo upload.
 *
 * Sem esse upload o header ficaria sem `url`/`mediaKey`/hashes e o WhatsApp
 * simplesmente não renderiza o carrossel.
 */

export interface CarouselCardRequest {
  body: string
  title?: string
  footer?: string
  /** URL http(s) ou caminho absoluto/local de uma imagem. */
  media: string
  mimetype?: string
  buttons: readonly { id: string; text: string }[]
}

export interface CarouselRequest {
  to: string
  body?: string
  cards: readonly CarouselCardRequest[]
  quote?: QuoteRef
}

const MAX_CARDS = 10
const MAX_BUTTONS_PER_CARD = 3

export class CarouselRequestError extends Error {
  readonly _tag = "CarouselRequestError"
}

interface LoadedMedia {
  source: Uint8Array | string
  /** Content-Type devolvido pelo servidor, quando a mídia veio por URL. */
  mimetype?: string
}

async function loadMediaSource(media: string): Promise<LoadedMedia> {
  if (/^https?:\/\//i.test(media)) {
    const response = await fetch(media)
    if (!response.ok) {
      throw new CarouselRequestError(`falha ao baixar a mídia do card (${response.status}) — ${media}`)
    }
    const header = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
    return {
      source: new Uint8Array(await response.arrayBuffer()),
      mimetype: header && header.startsWith("image/") ? header : undefined,
    }
  }
  if (/^data:/i.test(media)) {
    throw new CarouselRequestError("mídia em base64/data URI não é suportada; use URL http(s) ou caminho de arquivo")
  }
  return { source: media }
}

async function uploadCardMedia(
  client: WaClient,
  card: CarouselCardRequest,
  position: number,
): Promise<{ readonly imageMessage: Proto.Message.IImageMessage }> {
  const loaded = await loadMediaSource(card.media)
  // Precedência: mimetype explícito > Content-Type da URL > extensão do arquivo.
  // URL sem extensão (ex.: placehold.co/600x400/png) só funciona pelos dois
  // primeiros — por isso a validação anterior recusava carrossel válido.
  const mimetype = card.mimetype ?? loaded.mimetype ?? inferMimetype(card.media)
  if (!mimetype || !mimetype.startsWith("image/")) {
    throw new CarouselRequestError(
      `card ${position}: "media" precisa ser uma imagem (png/jpeg/webp) — recebido mimetype "${mimetype ?? "desconhecido"}". Informe "mimetype" para URLs sem extensão.`,
    )
  }

  const uploaded = await client.message.upload(loaded.source, { type: "image", mimetype })

  return {
    imageMessage: {
      url: uploaded.url,
      directPath: uploaded.directPath,
      mediaKey: uploaded.mediaKey,
      fileSha256: uploaded.fileSha256,
      fileEncSha256: uploaded.fileEncSha256,
      fileLength: uploaded.fileLength,
      mediaKeyTimestamp: uploaded.mediaKeyTimestamp,
      mimetype,
    },
  }
}

export function validateCarouselRequest(cards: readonly CarouselCardRequest[]): void {
  if (cards.length === 0) throw new CarouselRequestError("carrossel exige pelo menos 1 card")
  if (cards.length > MAX_CARDS) throw new CarouselRequestError(`carrossel aceita no máximo ${MAX_CARDS} cards`)

  cards.forEach((card, index) => {
    const position = index + 1
    if (!card.body.trim()) throw new CarouselRequestError(`card ${position}: "body" é obrigatório`)
    if (!card.media.trim()) {
      throw new CarouselRequestError(`card ${position}: "media" é obrigatório (URL ou caminho de imagem)`)
    }
    if (card.buttons.length === 0) throw new CarouselRequestError(`card ${position}: informe ao menos 1 botão`)
    if (card.buttons.length > MAX_BUTTONS_PER_CARD) {
      throw new CarouselRequestError(`card ${position}: máximo de ${MAX_BUTTONS_PER_CARD} botões`)
    }
  })
}

export async function sendCarousel(client: WaClient, request: CarouselRequest): Promise<SendResult> {
  validateCarouselRequest(request.cards)

  const cards: CarouselCardInput[] = []
  for (const [index, card] of request.cards.entries()) {
    cards.push({
      body: card.body,
      title: card.title,
      footer: card.footer,
      media: await uploadCardMedia(client, card, index + 1),
      buttons: card.buttons,
    })
  }

  const message = carouselMessage({ body: request.body, cards })
  const result = await client.message.send(request.to, message, request.quote ? { quote: request.quote } : undefined)
  return { messageId: result?.id }
}
