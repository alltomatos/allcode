import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

// Meta-teste do contrato de deltas (docs/agents/providers.md, DELTAS.md).
//
// Regra: toda linha da tabela de `DELTAS.md` precisa de um teste cujo nome,
// escrito entre crases na coluna `Teste`, exista literalmente em algum arquivo
// de teste do repositório. Delta sem teste é regressão.

const root = path.resolve(import.meta.dir, "../../../..")

type DeltaRow = { id: string; test: string | undefined }

const ID = /^D\d{3}$/

function cells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
}

/** Extrai as linhas da tabela em `## Deltas`, ignorando cabeçalho e separador. */
export function parseDeltas(markdown: string): DeltaRow[] {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => /^##\s+Deltas\b/.test(line))
  if (start === -1) return []

  const rows: DeltaRow[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break
    if (!line.trim().startsWith("|")) continue
    const [id, , , testCell] = cells(line)
    if (!id || !ID.test(id)) continue
    const literal = testCell?.match(/`([^`]+)`/)?.[1]?.trim()
    rows.push({ id, test: literal || undefined })
  }
  return rows
}

/** Arquivos de teste do repositório, sem dependências nem artefatos de build. */
export function testFiles(dir: string): string[] {
  const glob = new Bun.Glob("packages/**/*.{test,spec}.{ts,tsx}")
  return Array.from(glob.scanSync({ cwd: dir, dot: false })).filter(
    (file) => !file.includes("node_modules") && !file.includes("/dist/") && !file.includes("/.git/"),
  )
}

/** Nome do teste encontrado literalmente em algum arquivo de teste. */
export function findTestName(name: string, dir: string, files: string[]): string | undefined {
  for (const file of files) {
    const content = readFileSync(path.join(dir, file), "utf8")
    if (content.includes(name)) return file
  }
  return undefined
}

describe("parser de DELTAS.md", () => {
  test("tabela vazia não produz linhas", () => {
    const markdown = ["## Deltas", "", "| ID | Delta |", "| --- | --- |", "| _(nenhum)_ | |"].join("\n")
    expect(parseDeltas(markdown)).toEqual([])
  })

  test("extrai id e nome do teste entre crases", () => {
    const markdown = [
      "## Deltas",
      "",
      "| ID | Delta | Consumidor | Teste | Impacto | Reversível | Fase |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| D001 | fallback | AgentUI | `cai no default quando o modelo some` | aviso | commit | F1.5 |",
    ].join("\n")

    expect(parseDeltas(markdown)).toEqual([{ id: "D001", test: "cai no default quando o modelo some" }])
  })

  test("linha sem nome entre crases fica sem teste", () => {
    const markdown = [
      "## Deltas",
      "| ID | Teste |",
      "| --- | --- |",
      "| D002 | sem crase |",
    ].join("\n")

    expect(parseDeltas(markdown)).toEqual([{ id: "D002", test: undefined }])
  })

  test("para na próxima seção", () => {
    const markdown = [
      "## Deltas",
      "| D003 | `algo` |",
      "## Outra",
      "| D004 | `outro` |",
    ].join("\n")

    expect(parseDeltas(markdown).map((row) => row.id)).toEqual(["D003"])
  })
})

describe("meta-teste do repositório", () => {
  const markdown = readFileSync(path.join(root, "DELTAS.md"), "utf8")
  const rows = parseDeltas(markdown)
  const files = testFiles(root)

  test("DELTAS.md existe e é legível", () => {
    expect(typeof markdown).toBe("string")
  })

  test("todo delta tem teste nomeado", () => {
    const missing = rows.filter((row) => !row.test).map((row) => row.id)
    expect(missing).toEqual([])
  })

  test("todo teste nomeado existe no repositório", () => {
    const orphans = rows.filter((row) => row.test && !findTestName(row.test, root, files)).map((row) => row.id)
    expect({ orphans, files: files.length }).toEqual({ orphans: [], files: files.length })
  })
})


