export * as DefaultSkills from "./default-skills"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { FILES, VERSION } from "./skills.gen"

// The skills are embedded in the binary (see script/generate-skills.ts) so a
// fresh install works offline instead of downloading a moving branch at
// runtime. They are seeded into the legacy config dir because the loader scans
// both ~/.allcode and ~/.opencode for skill folders.
const TARGET = join(".opencode", "skills")
const MARKER = ".allcode-skills.json"

type Marker = {
  version?: string
}

export type SeedResult = {
  target: string
  written: number
  skipped: boolean
}

export async function ensureDefaultSkills(home: string, options?: { force?: boolean }): Promise<SeedResult> {
  const target = join(home, TARGET)
  const markerPath = join(target, MARKER)

  if (!options?.force && (await readMarker(markerPath))?.version === VERSION) {
    return { target, written: 0, skipped: true }
  }

  await mkdir(target, { recursive: true })

  let written = 0
  for (const [relative, content] of Object.entries(FILES)) {
    const dest = join(target, relative)
    await mkdir(dirname(dest), { recursive: true })

    try {
      // Never overwrite a skill the user edited or replaced. Missing files are
      // still filled in, which also repairs a folder left half-seeded by an
      // older build.
      await writeFile(dest, content, { flag: "wx" })
      written++
    } catch (error) {
      if (!isExistsError(error)) throw error
    }
  }

  await writeFile(markerPath, `${JSON.stringify({ version: VERSION, files: Object.keys(FILES).length }, null, 2)}\n`)
  return { target, written, skipped: false }
}

export async function seedDefaultSkills(home: string) {
  try {
    return await ensureDefaultSkills(home)
  } catch (error) {
    console.error("default-skills: failed to seed bundled skills", error)
    return undefined
  }
}

async function readMarker(path: string): Promise<Marker | undefined> {
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
