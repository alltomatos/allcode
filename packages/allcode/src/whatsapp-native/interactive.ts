import type { Proto } from "zapo-js"

/**
 * Builders de mensagens interativas para o `zapo`.
 *
 * O `zapo` não expõe helpers de alto nível para botões/listas/pagamento: o
 * caminho suportado é enviar um `Proto.IMessage` cru em `client.message.send`
 * (o coordinator aplica o contextInfo/quote e o builder de nó detecta
 * `payment_info`/`order_details` para emitir `<biz><interactive type="native_flow">`).
 *
 * Referências dos identificadores `name` usados aqui:
 * - `quick_reply` / `cta_url` → botões Native Flow
 * - `payment_info` → botão de pagamento PIX (native flow de pagamento)
 */

const MAX_BUTTONS = 3
const MAX_SECTIONS = 10
const MAX_ROWS_PER_SECTION = 10
const MAX_CAROUSEL_CARDS = 10

export interface QuickReplyButtonInput {
  /** Id devolvido quando o usuário toca no botão. */
  id: string
  /** Texto exibido (o WhatsApp corta por volta de 20 caracteres). */
  text: string
}

export interface InteractiveBase {
  body: string
  title?: string
  footer?: string
}

function interactive(
  input: InteractiveBase,
  buttons: { name: string; buttonParamsJson: string }[],
): Proto.IMessage {
  return {
    interactiveMessage: {
      header: input.title ? { title: input.title, hasMediaAttachment: false } : undefined,
      body: { text: input.body },
      footer: input.footer ? { text: input.footer } : undefined,
      nativeFlowMessage: {
        messageVersion: 1,
        buttons: buttons.slice(0, MAX_BUTTONS),
      },
    },
  }
}

function quickReplyButton(button: QuickReplyButtonInput) {
  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: button.text, id: button.id }),
  }
}

/** Até 3 botões de resposta rápida (o toque devolve o `id` do botão). */
export function quickReplyButtons(input: InteractiveBase & { buttons: readonly QuickReplyButtonInput[] }): Proto.IMessage {
  return interactive(input, input.buttons.map(quickReplyButton))
}

/** Um botão que abre uma URL (cta_url). */
export function ctaUrlButton(input: InteractiveBase & { label: string; url: string }): Proto.IMessage {
  return interactive(input, [
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: input.label,
        url: input.url,
        merchant_url: input.url,
      }),
    },
  ])
}

export interface ListRowInput {
  id: string
  title: string
  description?: string
}

export interface ListSectionInput {
  title?: string
  rows: readonly ListRowInput[]
}

/** Lista de seleção única (mensagem clássica `listMessage`). */
export function listMessage(
  input: Pick<InteractiveBase, "body" | "title" | "footer"> & {
    buttonText: string
    sections: readonly ListSectionInput[]
  },
): Proto.IMessage {
  return {
    listMessage: {
      title: input.title,
      description: input.body,
      buttonText: input.buttonText,
      // 1 === ListType.SINGLE_SELECT
      listType: 1 as Proto.Message.ListMessage.ListType,
      footerText: input.footer,
      sections: input.sections.slice(0, MAX_SECTIONS).map((section) => ({
        title: section.title,
        rows: section.rows.slice(0, MAX_ROWS_PER_SECTION).map((row) => ({
          title: row.title,
          description: row.description,
          rowId: row.id,
        })),
      })),
    },
  }
}

export interface PixInput extends InteractiveBase {
  /** Chave PIX (aleatória, telefone, e-mail, CPF ou CNPJ). */
  key: string
  keyType?: "EVP" | "PHONE" | "EMAIL" | "CPF" | "CNPJ"
  merchantName?: string
  /** Valor em centavos. Ausente = o pagador digita o valor. */
  amountCents?: number
  referenceId?: string
}

/**
 * Botão de pagamento PIX (`payment_info`). O `zapo` já sabe emitir a stanza
 * `<biz><interactive type="native_flow"><native_flow name="payment_info">`:
 * basta o primeiro botão se chamar `payment_info` e carregar o payload em
 * `buttonParamsJson`.
 */
export function pixPaymentButton(input: PixInput): Proto.IMessage {
  const params = {
    currency: "BRL",
    type: "physical-goods",
    reference_id: input.referenceId ?? `pix-${Date.now()}`,
    ...(input.amountCents && input.amountCents > 0
      ? { total_amount: { value: Math.round(input.amountCents), offset: 100 } }
      : {}),
    payment_settings: [
      {
        type: "pix_static_code",
        pix_static_code: {
          key: input.key,
          key_type: input.keyType ?? "EVP",
          merchant_name: input.merchantName ?? "",
        },
      },
    ],
  }
  return interactive(input, [{ name: "payment_info", buttonParamsJson: JSON.stringify(params) }])
}

/** M�dia j� convertida para o fragmento de header do card. */
export type CarouselCardMedia =
  | { readonly imageMessage: Proto.Message.IImageMessage }
  | { readonly videoMessage: Proto.Message.IVideoMessage }

export interface CarouselCardInput {
  /** Texto do card (obrigatório). */
  body: string
  /** Título opcional acima do texto. */
  title?: string
  footer?: string
  /**
   * Mídia do card, já enviada ao CDN do WhatsApp. É OBRIGATÓRIA: sem
   * `header.hasMediaAttachment` + `imageMessage`/`videoMessage`, o WhatsApp Web
   * não renderiza o carrossel e cai no fallback de "mensagem não suportada".
   */
  media: CarouselCardMedia
  buttons: readonly QuickReplyButtonInput[]
}

export interface CarouselInput {
  body?: string
  cards: readonly CarouselCardInput[]
}

export class CarouselValidationError extends Error {
  readonly _tag = "CarouselValidationError"
}

/**
 * Contrato do carrossel conforme o protobuf do WhatsApp Web
 * (`Message.InteractiveMessage.CarouselMessage`):
 *
 * ```
 * interactiveMessage {
 *   body?: { text }
 *   carouselMessage {
 *     messageVersion: 1
 *     carouselCardType: HSCROLL_CARDS (1)
 *     cards: [{
 *       header: { hasMediaAttachment: true, imageMessage | videoMessage }
 *       body: { text }
 *       footer?: { text }
 *       nativeFlowMessage: { messageVersion: 1, buttons }
 *     }]
 *   }
 * }
 * ```
 *
 * Regras aplicadas aqui (validadas com erro explícito, não silencioso):
 * - 1 a 10 cards;
 * - todo card precisa de mídia (imagem ou vídeo), corpo não vazio e 1 a 3 botões;
 * - `carouselCardType` é `HSCROLL_CARDS`, o valor que o cliente usa na prática.
 */
export function carouselMessage(input: CarouselInput): Proto.IMessage {
  if (input.cards.length === 0) throw new CarouselValidationError("carrossel exige pelo menos 1 card")
  if (input.cards.length > MAX_CAROUSEL_CARDS) {
    throw new CarouselValidationError(`carrossel aceita no máximo ${MAX_CAROUSEL_CARDS} cards`)
  }

  const cards = input.cards.map((card, index) => {
    const position = index + 1
    if (!card.body.trim()) throw new CarouselValidationError(`card ${position}: "body" é obrigatório`)
    if (!card.media) {
      throw new CarouselValidationError(
        `card ${position}: "media" é obrigatório (o WhatsApp não renderiza carrossel sem mídia no header)`,
      )
    }
    if (card.buttons.length === 0) throw new CarouselValidationError(`card ${position}: informe ao menos 1 botão`)
    if (card.buttons.length > MAX_BUTTONS) {
      throw new CarouselValidationError(`card ${position}: máximo de ${MAX_BUTTONS} botões`)
    }

    return {
      header: {
        // `hasMediaAttachment` é o que faz o cliente renderizar o header como mídia.
        hasMediaAttachment: true,
        ...card.media,
      },
      body: { text: card.body },
      footer: card.footer ? { text: card.footer } : undefined,
      nativeFlowMessage: {
        messageVersion: 1,
        buttons: card.buttons.map(quickReplyButton),
      },
    }
  })

  return {
    interactiveMessage: {
      body: input.body ? { text: input.body } : undefined,
      // Marcador obrigatório: o zapo decide se injeta a stanza
      // `<biz><interactive type="native_flow">` olhando o conteúdo de topo
      // (`listMessage` / `buttonsMessage` / `interactiveMessage.nativeFlowMessage`).
      // Um carrossel puro (`carouselMessage` apenas) faz o zapo não emitir o
      // nó `biz` — e o cliente oficial então descarta a mensagem como
      // "não suportada". Este native flow vazio existe só para disparar o nó;
      // o conteúdo real continua sendo `carouselMessage`.
      nativeFlowMessage: { messageVersion: 1, buttons: [] },
      carouselMessage: {
        messageVersion: 1,
        carouselCardType: 1 as Proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType,
        cards,
      },
    },
  }
}
