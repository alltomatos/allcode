import { describe, expect, test } from "bun:test"
import { createDraftCreationGuard, draftCreationKey, findDraftFor } from "./tabs-draft"

// "Nova sessão" deve ser idempotente por projeto: cliques repetidos reabrem o
// rascunho existente em vez de criar outro (causa do bug de várias abas
// aparecerem de uma vez).
const server = "local"

type Tab =
  | { type: "draft"; draftID: string; server: string; directory: string }
  | { type: "session"; server: string; sessionId: string }

const draft = (draftID: string, directory: string, key = server): Tab => ({
  type: "draft",
  draftID,
  server: key,
  directory,
})

const session = (sessionId: string, key = server): Tab => ({ type: "session", server: key, sessionId })

describe("findDraftFor", () => {
  test("encontra o rascunho do mesmo projeto", () => {
    const tabs: Tab[] = [session("s1"), draft("d1", "/proj/a")]

    expect(findDraftFor(tabs, server, "/proj/a")?.draftID).toBe("d1")
  })

  test("não reutiliza rascunho de outro projeto", () => {
    expect(findDraftFor([draft("d1", "/proj/a")], server, "/proj/b")).toBeUndefined()
  })

  test("não reutiliza rascunho de outro servidor", () => {
    expect(findDraftFor([draft("d1", "/proj/a", "remote")], server, "/proj/a")).toBeUndefined()
  })

  test("ignora abas de sessão", () => {
    expect(findDraftFor([session("s1"), session("s2")], server, "/proj/a")).toBeUndefined()
  })

  test("retorna o primeiro rascunho quando há duplicatas legadas", () => {
    expect(findDraftFor([draft("d1", "/proj/a"), draft("d2", "/proj/a")], server, "/proj/a")?.draftID).toBe("d1")
  })
})

describe("createDraftCreationGuard", () => {
  test("cliques/atalhos concorrentes compartilham uma única criação", async () => {
    const guard = createDraftCreationGuard<string>()
    let calls = 0
    let release!: (value: string) => void
    const key = draftCreationKey(server, "/proj/a")

    const first = guard(key, () => {
      calls++
      return new Promise<string>((resolve) => {
        release = resolve
      })
    })
    // Segundo acionamento enquanto o primeiro ainda está em voo.
    const second = guard(key, () => {
      calls++
      return Promise.resolve("outro")
    })

    expect(calls).toBe(1)
    expect(second).toBe(first)

    release("d1")
    expect(await first).toBe("d1")
    expect(await second).toBe("d1")
  })

  test("projetos diferentes não bloqueiam um ao outro", async () => {
    const guard = createDraftCreationGuard<string>()
    const a = guard(draftCreationKey(server, "/proj/a"), () => Promise.resolve("a"))
    const b = guard(draftCreationKey(server, "/proj/b"), () => Promise.resolve("b"))

    expect(await Promise.all([a, b])).toEqual(["a", "b"])
  })

  test("após concluir, uma nova criação é permitida", async () => {
    const guard = createDraftCreationGuard<string>()
    const key = draftCreationKey(server, "/proj/a")
    let calls = 0
    const create = () => {
      calls++
      return Promise.resolve(`d${calls}`)
    }

    expect(await guard(key, create)).toBe("d1")
    expect(await guard(key, create)).toBe("d2")
    expect(calls).toBe(2)
  })

  test("falha não deixa o botão travado: a chave é liberada e o erro propaga", async () => {
    const guard = createDraftCreationGuard<string>()
    const key = draftCreationKey(server, "/proj/a")
    let calls = 0

    const failed = guard(key, () => {
      calls++
      return Promise.reject(new Error("navegação falhou"))
    })
    await expect(failed).rejects.toThrow("navegação falhou")

    // O erro foi tratado; uma nova tentativa deve criar novamente.
    const retried = guard(key, () => {
      calls++
      return Promise.resolve("d2")
    })
    expect(calls).toBe(2)
    expect(await retried).toBe("d2")
  })
})
