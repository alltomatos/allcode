import { describe, expect, test } from "bun:test"
import { findDraftFor } from "./tabs-draft"

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
