import { describe, expect, test } from "bun:test"
import { WhatsAppNativeState, WhatsAppNativeStatus, WhatsAppNativeEvent } from "../src/whatsapp-native/schema"
import { getWhatsAppNativeStore } from "../src/whatsapp-native/store"
import { WhatsAppNativeManager } from "../src/whatsapp-native/manager"

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
