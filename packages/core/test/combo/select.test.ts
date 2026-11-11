import { describe, expect, test } from "bun:test"
import { ComboSelect } from "@allcode/core/combo/select"

// D002 — seleção de membro de combo. Este helper é compartilhado pelos dois
// resolvedores (`Combo.resolve` no runtime e `SessionRunnerModel.resolveComboModel`
// no core), então a paridade é estrutural: mesma ordem, mesmo filtro, mesmo erro.

const ordered = (...models: string[]) => models.map((model) => ({ model }))

describe("pickComboModel", () => {
  test("escolhe o primeiro elegível na ordem recebida", () => {
    expect(ComboSelect.pickComboModel({ ordered: ordered("a/1", "b/2") })).toEqual({
      providerID: "a",
      modelID: "1",
    })
  })

  test("descarta membro indisponível e escolhe o próximo elegível", () => {
    const picked = ComboSelect.pickComboModel({
      ordered: ordered("opencode-go/paid-x", "opencode/free-a"),
      isSelectable: (selection) => selection.providerID === "opencode",
    })

    expect(picked).toEqual({ providerID: "opencode", modelID: "free-a" })
  })

  test("todos indisponíveis não devolve seleção", () => {
    const picked = ComboSelect.pickComboModel({
      ordered: ordered("opencode-go/paid-x", "opencode-go/paid-y"),
      isSelectable: () => false,
    })

    expect(picked).toBeUndefined()
  })

  test("failover evita o último que falhou", () => {
    const picked = ComboSelect.pickComboModel({
      ordered: ordered("a/1", "b/2"),
      skip: "a/1",
    })

    expect(picked).toEqual({ providerID: "b", modelID: "2" })
  })

  test("usa o que falhou como último recurso", () => {
    const picked = ComboSelect.pickComboModel({
      ordered: ordered("a/1"),
      skip: "a/1",
    })

    expect(picked).toEqual({ providerID: "a", modelID: "1" })
  })

  test("failover e filtro juntos: skip indisponível não volta", () => {
    const picked = ComboSelect.pickComboModel({
      ordered: ordered("a/1", "b/2"),
      skip: "a/1",
      isSelectable: (selection) => selection.providerID === "b",
    })

    expect(picked).toEqual({ providerID: "b", modelID: "2" })
  })

  test("entrada sem barra é ignorada", () => {
    expect(ComboSelect.pickComboModel({ ordered: ordered("sem-barra") })).toBeUndefined()
  })

  test("mantém o namespace do provider no modelID", () => {
    expect(ComboSelect.pickComboModel({ ordered: ordered("omnrt/agy/gemini-3.7-flash-tiered") })).toEqual({
      providerID: "omnrt",
      modelID: "agy/gemini-3.7-flash-tiered",
    })
  })
})

