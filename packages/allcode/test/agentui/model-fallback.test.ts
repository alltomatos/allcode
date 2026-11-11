import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { AgentUI } from "@/agentui"

// D001 — decisão de fallback para o modelo padrão.
//
// A decisão é pura justamente para ser verificável sem subir o harness de LLM:
// a cobertura ponta a ponta do dispatch (canal + audit + UI) entra na validação
// de superfícies (#36).

describe("decisão de fallback (D001)", () => {
  test("modelo indisponível cai no padrão e registra origem e destino", () => {
    const decision = AgentUI.modelFallback({
      configured: { providerID: "opencode-go", modelID: "deepseek-v4-pro" },
      error: "Model not found: opencode-go/deepseek-v4-pro.",
    })

    expect(decision).toEqual({ from: "opencode-go/deepseek-v4-pro", to: "default" })
  })

  test("erro transitório do provider não vira fallback", () => {
    const decision = AgentUI.modelFallback({
      configured: { providerID: "anthropic", modelID: "claude-x" },
      error: "429 rate limited, retry after 30s",
    })

    expect(decision).toBeUndefined()
  })

  test("sem modelo configurado não há fallback", () => {
    expect(AgentUI.modelFallback({ error: "Model not found: x/y." })).toBeUndefined()
  })

  test("sem erro não há fallback", () => {
    expect(
      AgentUI.modelFallback({ configured: { providerID: "opencode", modelID: "free-a" } }),
    ).toBeUndefined()
  })
})

describe("audit de fallback", () => {
  const decode = Schema.decodeUnknownSync(AgentUI.AuditEntry)

  test("entrada com tag e detail decodifica", () => {
    const entry = decode({
      id: "1",
      timestamp: 1,
      channel: "whatsapp",
      chatKey: "chat",
      incoming: "oi",
      outgoing: "olá",
      blocked: false,
      tag: "model_fallback",
      detail: "opencode-go/paid -> default",
    })

    expect(entry.tag).toBe("model_fallback")
    expect(entry.detail).toBe("opencode-go/paid -> default")
  })

  test("entrada antiga sem tag continua decodificando", () => {
    const entry = decode({
      id: "2",
      timestamp: 2,
      channel: "sandbox",
      chatKey: "sandbox",
      incoming: "oi",
      outgoing: "olá",
      blocked: false,
    })

    expect(entry.tag).toBeUndefined()
  })
})
