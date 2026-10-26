import { describe, expect, test } from "bun:test"
import { WhatsAppNativeState, WhatsAppNativeStatus, WhatsAppNativeEvent } from "../src/whatsapp-native/schema"
import { getWhatsAppNativeStore } from "../src/whatsapp-native/store"
import { WhatsAppNativeManager } from "../src/whatsapp-native/manager"
import {
  carouselMessage,
  ctaUrlButton,
  listMessage,
  pixPaymentButton,
  quickReplyButtons,
} from "../src/whatsapp-native/interactive"
import { inferMimetype, mediaKindFromMimetype } from "../src/whatsapp-native/media"
import { validateCarouselRequest } from "../src/whatsapp-native/carousel"
describe("WhatsAppNative", () => {
  test("schema valida status e eventos", () => {
    const status: WhatsAppNativeStatus = {
      agentId: "test-agent",
      state: "connected",
      phone: "558599999999",
      connectedAt: 1729000000000,
    }
    expect(status.agentId).toBe("test-agent")
    expect(status.state).toBe("connected")

    const event: WhatsAppNativeEvent = {
      agentId: "test-agent",
      state: "qr_ready",
      qr: "test-qr-string",
      ttlMs: 60000,
    }
    expect(event.qr).toBe("test-qr-string")
    expect(event.state).toBe("qr_ready")
  })

  test("store inicializa banco SQLite via bun:sqlite", async () => {
    const store = await getWhatsAppNativeStore()
    expect(store.dbPath).toContain("state.sqlite")
    expect(store.store).toBeDefined()
  })

  test("manager mantém ciclo de vida e listeners SSE", () => {
    const manager = new WhatsAppNativeManager()
    expect(manager.getStatus("agent-1").state).toBe("idle")

    const events: WhatsAppNativeEvent[] = []
    const unsub = manager.addListener("agent-1", (evt) => {
      events.push(evt)
    })

    expect(events.length).toBeGreaterThan(0)
    expect(events[0].state).toBe("idle")
    unsub()
  })
})

describe("WhatsAppNative interactive builders", () => {
  test("quick replies viram native flow com quick_reply e id no payload", () => {
    const message = quickReplyButtons({
      body: "Escolha uma opção",
      title: "Atendimento",
      buttons: [
        { id: "sim", text: "Sim" },
        { id: "nao", text: "Não" },
        { id: "quarta", text: "Ignorado" },
        { id: "quinta", text: "Ignorado" },
      ],
    }) as any

    const flow = message.interactiveMessage.nativeFlowMessage
    expect(flow.buttons).toHaveLength(3)
    expect(flow.buttons[0].name).toBe("quick_reply")
    expect(JSON.parse(flow.buttons[0].buttonParamsJson)).toEqual({ display_text: "Sim", id: "sim" })
    expect(message.interactiveMessage.body.text).toBe("Escolha uma opção")
  })

  test("cta_url carrega label e url no buttonParamsJson", () => {
    const message = ctaUrlButton({ body: "Site", label: "Abrir", url: "https://allcode.dev" }) as any
    const button = message.interactiveMessage.nativeFlowMessage.buttons[0]
    expect(button.name).toBe("cta_url")
    expect(JSON.parse(button.buttonParamsJson)).toMatchObject({
      display_text: "Abrir",
      url: "https://allcode.dev",
    })
  })

  test("lista monta seções e linhas com rowId", () => {
    const message = listMessage({
      body: "Selecione",
      buttonText: "Ver opções",
      sections: [{ title: "Planos", rows: [{ id: "pro", title: "Pro", description: "R$ 99" }] }],
    }) as any
    expect(message.listMessage.listType).toBe(1)
    expect(message.listMessage.sections[0].rows[0].rowId).toBe("pro")
  })

  test("PIX usa payment_info com pix_static_code e valor em centavos", () => {
    const message = pixPaymentButton({
      body: "Pague via PIX",
      key: "pix@allcode.dev",
      keyType: "EMAIL",
      merchantName: "AllCode",
      amountCents: 12345,
      referenceId: "ref-1",
    }) as any
    const button = message.interactiveMessage.nativeFlowMessage.buttons[0]
    expect(button.name).toBe("payment_info")
    const params = JSON.parse(button.buttonParamsJson)
    expect(params.currency).toBe("BRL")
    expect(params.total_amount).toEqual({ value: 12345, offset: 100 })
    expect(params.payment_settings[0]).toMatchObject({
      type: "pix_static_code",
      pix_static_code: { key: "pix@allcode.dev", key_type: "EMAIL", merchant_name: "AllCode" },
    })
  })

  test("carrossel aninha cards com mídia obrigatória no header", () => {
    const media = { imageMessage: { url: "https://cdn.example/card.jpg", mimetype: "image/jpeg" } }
    const message = carouselMessage({
      body: "Produtos",
      cards: [{ body: "Card 1", title: "Um", media, buttons: [{ id: "a", text: "Ver" }] }],
    }) as any

    const carousel = message.interactiveMessage.carouselMessage
    expect(carousel.messageVersion).toBe(1)
    expect(carousel.carouselCardType).toBe(1)

    // O zapo só injeta a stanza <biz><interactive type="native_flow"> quando
    // encontra um native flow no topo; sem isso o cliente descarta o carrossel.
    expect(message.interactiveMessage.nativeFlowMessage).toEqual({ messageVersion: 1, buttons: [] })

    const card = carousel.cards[0]
    expect(card.header.hasMediaAttachment).toBe(true)
    expect(card.header.imageMessage.url).toBe("https://cdn.example/card.jpg")
    expect(card.nativeFlowMessage.buttons[0].name).toBe("quick_reply")
    expect(card.body.text).toBe("Card 1")
  })

  test("carrossel rejeita cards sem mídia, sem corpo ou fora do limite", () => {
    const media = { imageMessage: { url: "https://cdn.example/card.jpg", mimetype: "image/jpeg" } }
    const card = (over: Record<string, unknown> = {}) => ({
      body: "Card",
      media,
      buttons: [{ id: "a", text: "Ver" }],
      ...over,
    })

    expect(() => carouselMessage({ cards: [] })).toThrow(/pelo menos 1 card/)
    expect(() =>
      carouselMessage({ cards: Array.from({ length: 11 }, (_, i) => card({ body: `Card ${i}` })) }),
    ).toThrow(/no máximo 10 cards/)
    expect(() => carouselMessage({ cards: [{ ...card(), media: undefined }] as any })).toThrow(/media.*obrigat/i)
    expect(() => carouselMessage({ cards: [card({ body: "   " })] })).toThrow(/body.*obrigat/i)
    expect(() => carouselMessage({ cards: [card({ buttons: [] })] })).toThrow(/ao menos 1 botão/)
    expect(() =>
      carouselMessage({
        cards: [
          card({
            buttons: [
              { id: "1", text: "a" },
              { id: "2", text: "b" },
              { id: "3", text: "c" },
              { id: "4", text: "d" },
            ],
          }),
        ],
      }),
    ).toThrow(/máximo de 3 botões/)
  })

  test("carrossel valida a requisição antes de subir mídia", () => {
    expect(() => validateCarouselRequest([])).toThrow(/pelo menos 1 card/)
    expect(() =>
      validateCarouselRequest([{ body: "ok", media: "", buttons: [{ id: "a", text: "Ver" }] }]),
    ).toThrow(/media.*obrigat/i)
    expect(() => validateCarouselRequest([{ body: "ok", media: "/tmp/a.png", buttons: [] }])).toThrow(
      /ao menos 1 botão/,
    )
    expect(() =>
      validateCarouselRequest([{ body: "ok", media: "/tmp/a.png", buttons: [{ id: "a", text: "Ver" }] }]),
    ).not.toThrow()
  })
})

describe("WhatsAppNative media helpers", () => {
  test("infere mimetype e tipo por extensão", () => {
    expect(inferMimetype("/tmp/foto.PNG")).toBe("image/png")
    expect(inferMimetype("https://cdn.dev/doc.pdf?x=1")).toBe("application/pdf")
    expect(mediaKindFromMimetype("video/mp4")).toBe("video")
    expect(mediaKindFromMimetype("audio/ogg; codecs=opus")).toBe("audio")
    expect(mediaKindFromMimetype(undefined)).toBe("document")
  })
})
