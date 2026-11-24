import { describe, expect, test } from "bun:test"
import { skillModelGuard } from "@/schedule/skill-caller"

// D005 — rotina de skill sem `agentId` aborta antes de criar sessão quando o
// modelo configurado em `action.model` não está disponível.

describe("skillModelGuard (D005)", () => {
  test("modelo indisponível retorna erro específico com modelo e origem", () => {
    const guard = skillModelGuard({
      model: { providerID: "opencode-go", modelID: "deepseek-v4-pro" },
      available: false,
    })

    expect(guard).toEqual({ error: "modelo configurado indisponível: opencode-go/deepseek-v4-pro" })
  })

  test("modelo disponível não bloqueia", () => {
    expect(
      skillModelGuard({ model: { providerID: "opencode", modelID: "free-a" }, available: true }),
    ).toBeUndefined()
  })

  test("rotina sem modelo próprio não bloqueia", () => {
    expect(skillModelGuard({ available: false })).toBeUndefined()
  })
})
