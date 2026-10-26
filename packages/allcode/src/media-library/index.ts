import fs from "node:fs/promises"
import path from "node:path"

/**
 * Biblioteca de mídia local do agente.
 *
 * O agente pode navegar por pastas configuradas no AgentUI (`mediaDirs`) e
 * enviar arquivos dessas pastas pelo WhatsApp. Toda resolução passa por aqui
 * para garantir que nada fora das raízes seja lido — inclusive via `..` ou
 * symlink.
 */

export class MediaLibraryError extends Error {
  readonly _tag = "MediaLibraryError"
}

export type MediaKind = "image" | "video" | "audio" | "document"

const EXTENSIONS: Record<string, MediaKind> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".mp4": "video",
  ".mov": "video",
  ".mkv": "video",
  ".webm": "video",
  ".mp3": "audio",
  ".ogg": "audio",
  ".opus": "audio",
  ".m4a": "audio",
  ".wav": "audio",
  ".pdf": "document",
  ".doc": "document",
  ".docx": "document",
  ".xls": "document",
  ".xlsx": "document",
  ".csv": "document",
  ".txt": "document",
  ".zip": "document",
}

export interface MediaEntry {
  name: string
  /** Caminho absoluto, sempre dentro de uma raiz permitida. */
  path: string
  kind: MediaKind
  size: number
  modifiedAt: number
}

export interface MediaFolder {
  name: string
  path: string
  /** Quantidade de arquivos de mídia diretamente nesta pasta. */
  files: number
  /** Quantidade de subpastas. */
  subfolders: number
}

export interface MediaListing {
  /** Raízes configuradas para o agente. */
  roots: string[]
  /** Pasta listada (absoluta) ou `undefined` quando listando as raízes. */
  folder?: string
  folders: MediaFolder[]
  files: MediaEntry[]
  /** `true` quando a listagem foi truncada pelo limite. */
  truncated: boolean
}

export function mediaKind(file: string): MediaKind | undefined {
  return EXTENSIONS[path.extname(file).toLowerCase()]
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function realpathSafe(target: string): Promise<string> {
  try {
    return await fs.realpath(target)
  } catch {
    return path.resolve(target)
  }
}

/** Normaliza e valida as raízes configuradas (ignora as que não existem). */
export async function normalizeRoots(roots: readonly string[]): Promise<string[]> {
  const result: string[] = []
  for (const root of roots) {
    if (!root.trim()) continue
    const resolved = await realpathSafe(path.resolve(root.trim()))
    const stat = await fs.stat(resolved).catch(() => undefined)
    if (!stat?.isDirectory()) continue
    if (!result.includes(resolved)) result.push(resolved)
  }
  return result
}

/**
 * Resolve um caminho pedido pelo agente contra as raízes permitidas.
 * `undefined`/"" devolve `undefined` (listar as raízes).
 */
export async function resolveMediaPath(
  roots: readonly string[],
  requested?: string,
): Promise<string | undefined> {
  const allowed = await normalizeRoots(roots)
  if (allowed.length === 0) {
    throw new MediaLibraryError(
      "Nenhuma pasta de mídia válida configurada para este agente (campo mediaDirs).",
    )
  }
  if (!requested || !requested.trim()) return undefined

  const candidate = path.isAbsolute(requested)
    ? path.resolve(requested)
    : path.resolve(allowed[0], requested)
  const real = await realpathSafe(candidate)

  if (!allowed.some((root) => isInside(root, real))) {
    throw new MediaLibraryError(
      `Caminho fora das pastas permitidas: ${requested}. Raízes: ${allowed.join(", ")}`,
    )
  }
  return real
}

async function countFolder(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  let files = 0
  let subfolders = 0
  for (const entry of entries) {
    if (entry.isDirectory()) subfolders++
    else if (entry.isFile() && mediaKind(entry.name)) files++
  }
  return { files, subfolders }
}

/**
 * Lista uma pasta (ou as raízes) com subpastas e arquivos de mídia.
 * `depth` controla quantos níveis descer (1 = só o nível atual).
 */
export async function listMedia(input: {
  roots: readonly string[]
  path?: string
  depth?: number
  limit?: number
}): Promise<MediaListing> {
  const roots = await normalizeRoots(input.roots)
  if (roots.length === 0) {
    throw new MediaLibraryError(
      "Nenhuma pasta de mídia válida configurada para este agente (campo mediaDirs).",
    )
  }

  const limit = Math.min(Math.max(input.limit ?? 200, 1), 1000)
  const depth = Math.min(Math.max(input.depth ?? 1, 1), 3)
  const requested = await resolveMediaPath(roots, input.path)
  // Com uma �nica raiz, listar "sem path" mostra o conte�do dela (subpastas e
  // arquivos) em vez de devolver a pr�pria raiz como uma pasta � � o que o
  // agente espera ao perguntar "o que tem na pasta?".
  const folder = requested ?? (roots.length === 1 ? roots[0] : undefined)

  const files: MediaEntry[] = []
  const folders: MediaFolder[] = []
  let truncated = false

  async function walk(dir: string, remaining: number) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch((error) => {
      if (error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT") return []
      throw error
    })

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".")) continue
      const absolute = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        const counts = await countFolder(absolute)
        folders.push({ name: entry.name, path: absolute, ...counts })
        if (remaining > 1) await walk(absolute, remaining - 1)
        continue
      }

      const kind = mediaKind(entry.name)
      if (!kind || !entry.isFile()) continue
      if (files.length >= limit) {
        truncated = true
        continue
      }
      const stat = await fs.stat(absolute).catch(() => undefined)
      if (!stat) continue
      files.push({
        name: entry.name,
        path: absolute,
        kind,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
      })
    }
  }

  if (folder) {
    await walk(folder, depth)
  } else {
    // Sem `path`: apresenta as raízes como "pastas" de nível superior.
    for (const root of roots) {
      const counts = await countFolder(root)
      folders.push({ name: path.basename(root) || root, path: root, ...counts })
      if (depth > 1) await walk(root, depth - 1)
    }
  }

  return { roots, folder, folders, files, truncated }
}

/** Busca arquivos de mídia por nome (substring, case-insensitive). */
export async function findMedia(input: {
  roots: readonly string[]
  query: string
  limit?: number
}): Promise<{ roots: string[]; query: string; results: MediaEntry[]; truncated: boolean }> {
  const roots = await normalizeRoots(input.roots)
  if (roots.length === 0) {
    throw new MediaLibraryError(
      "Nenhuma pasta de mídia válida configurada para este agente (campo mediaDirs).",
    )
  }
  const needle = input.query.trim().toLowerCase()
  if (!needle) throw new MediaLibraryError("Informe um termo para buscar (query).")

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 500)
  const results: MediaEntry[] = []
  let truncated = false

  async function walk(dir: string, depth: number) {
    if (depth > 6 || results.length >= limit) {
      if (results.length >= limit) truncated = true
      return
    }
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute, depth + 1)
        continue
      }
      const kind = mediaKind(entry.name)
      if (!kind || !entry.name.toLowerCase().includes(needle)) continue
      if (results.length >= limit) {
        truncated = true
        return
      }
      const stat = await fs.stat(absolute).catch(() => undefined)
      if (!stat) continue
      results.push({ name: entry.name, path: absolute, kind, size: stat.size, modifiedAt: stat.mtimeMs })
    }
  }

  for (const root of roots) await walk(root, 0)
  return { roots, query: input.query, results, truncated }
}
