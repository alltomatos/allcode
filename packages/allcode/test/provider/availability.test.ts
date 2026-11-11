import { describe, expect, test } from "bun:test"
import { selectableFrom } from "@/provider/availability"
import type { Provider } from "@/provider/provider"

// D002 (wiring v1) — o predicado compartilhado pelos quatro consumidores
// (AgentUI, SessionPrompt, Memory, endpoint experimental).

const providers = (entries: Record<string, string[]>) =>
  Object.fromEntries(
    Object.entries(entries).map(([providerID, models]) => [
      providerID,
      { id: providerID, models: Object.fromEntries(models.map((id) => [id, { id }])) },
    ]),
  ) as unknown as Record<string, Provider.Info>

describe("selectableFrom (D002)", () => {
  test("provider e modelo conhecidos são selecionáveis", () => {
    expect(selectableFrom(providers({ opencode: ["free-a"] }))({ providerID: "opencode", modelID: "free-a" })).toBe(
      true,
    )
  })

  test("provider ausente não é selecionável", () => {
    // Sem credencial no escopo atual, o provider nem entra no estado v1.
    expect(selectableFrom(providers({}))({ providerID: "opencode-go", modelID: "beam-free" })).toBe(false)
  })

  test("modelo ausente no provider conhecido não é selecionável", () => {
    expect(selectableFrom(providers({ opencode: ["free-a"] }))({ providerID: "opencode", modelID: "paid-x" })).toBe(
      false,
    )
  })
})
