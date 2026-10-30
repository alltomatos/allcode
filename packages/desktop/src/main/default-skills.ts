import { constants, existsSync } from "node:fs"
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const MARKER = ".allcode-skills.json"

function resolveDefaultSkillsSource(): string | undefined {
  const candidates = [
    join(process.resourcesPath, "default-skills"),
    join(process.resourcesPath, "resources", "default-skills"),
    join(__dirname, "skills", "default-skills"),
    join(__dirname, "../../resources/default-skills"),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

export async function ensureDefaultSkills() {
  const target = join(homedir(), ".opencode", "skills")
  const source = resolveDefaultSkillsSource()
  if (!source) return

  const bundled = await readMarker(join(source, MARKER))
  if (bundled?.version && (await readMarker(join(target, MARKER)))?.version === bundled.version) return

  try {
    await copyMissing(source, target)
    if (bundled) {
      await writeFile(join(target, MARKER), `${JSON.stringify(bundled, null, 2)}\n`)
    }
    console.log("default-skills", `seeded skills from ${source}`)
  } catch (error) {
    console.warn("default-skills", `failed to seed default skills: ${String(error)}`, error)
  }
}

async function copyMissing(src: string, dest: string) {
  await mkdir(dest, { recursive: true })

  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (entry.name === MARKER) continue
    const from = join(src, entry.name)
    const to = join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyMissing(from, to)
      continue
    }
    if (!entry.isFile()) continue

    try {
      // Do not clobber a user's edited skill; only fill in what is missing.
      await copyFile(from, to, constants.COPYFILE_EXCL)
    } catch (error) {
      if (!isExistsError(error)) throw error
    }
  }
}

async function readMarker(path: string): Promise<{ version?: string } | undefined> {
  try {
    const data: unknown = JSON.parse(await readFile(path, "utf8"))
    if (typeof data !== "object" || data === null || !("version" in data)) return undefined
    return { version: typeof data.version === "string" ? data.version : undefined }
  } catch {
    return undefined
  }
}

function isExistsError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST"
}
