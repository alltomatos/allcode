import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { AbsolutePath } from "@allcode/core/schema"

// Fixtures de sessão/projeto precisam de um diretório absoluto que exista de
// verdade: o core resolve o diretório da sessão via `FileSystem.realPath`, e um
// caminho fixo como "/project" não existe no Linux nem no Windows do CI.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "allcode-project-"))

process.on("exit", () => {
  try {
    fs.rmSync(root, { recursive: true, force: true })
  } catch {}
})

/** Diretório de projeto dos fixtures, já criado no disco. */
export const projectDirectory = root

/** Mesmo diretório como `AbsolutePath`, para `Location.Ref` e colunas do banco. */
export const projectAbsolute = AbsolutePath.make(root)

/** Subdiretório do projeto de fixtures, criado sob demanda. */
export function projectPath(...segments: string[]) {
  const target = path.join(root, ...segments)
  fs.mkdirSync(target, { recursive: true })
  return target
}
