#!/usr/bin/env bun

import { ZipReader, Uint8ArrayReader, Uint8ArrayWriter } from "@zip.js/zip.js"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { generate } from "./generate-skills"
import { SKILLS_ARCHIVE, SKILLS_COMMIT, SKILLS_REPO } from "./skills-upstream"

const vendorDir = path.resolve(import.meta.dirname, "..", "vendor")
const skillsDir = path.join(vendorDir, "skills")

const response = await fetch(SKILLS_ARCHIVE)
if (!response.ok) throw new Error(`Failed to download ${SKILLS_ARCHIVE}: HTTP ${response.status}`)

const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(await response.arrayBuffer())))
const entries = await reader.getEntries()

await rm(skillsDir, { recursive: true, force: true })
await mkdir(skillsDir, { recursive: true })

let count = 0
let license: string | undefined

for (const entry of entries) {
  if (entry.directory || !entry.getData) continue

  if (/^[^/]+\/LICENSE$/.test(entry.filename)) {
    license = new TextDecoder().decode(await entry.getData(new Uint8ArrayWriter()))
    continue
  }

  const match = /^[^/]+\/skills\/(.+)$/.exec(entry.filename)
  if (!match) continue

  const relative = match[1]
  const dest = path.resolve(skillsDir, relative)
  if (!dest.startsWith(skillsDir + path.sep)) throw new Error(`Unsafe zip entry: ${entry.filename}`)

  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, await entry.getData(new Uint8ArrayWriter()))
  count++
}

await reader.close()

if (!license) throw new Error(`Upstream archive did not contain a LICENSE file`)
await writeFile(path.join(vendorDir, "LICENSE"), license)
await writeFile(
  path.join(vendorDir, "UPSTREAM.md"),
  [
    "# Vendored skills",
    "",
    "These skills are a snapshot of [alltomatos/skills](https://github.com/alltomatos/skills),",
    "vendored into this repository so every AllCode build ships them offline instead",
    "of downloading a moving branch at runtime.",
    "",
    `- Upstream repository: \`${SKILLS_REPO}\``,
    `- Pinned commit: \`${SKILLS_COMMIT}\``,
    "- Upstream license: MIT (see `LICENSE` in this directory)",
    "",
    "The contents of `skills/` are copied verbatim from the upstream `skills/`",
    "directory at that commit. Do not edit them by hand; update the pinned commit in",
    "`packages/allcode/script/skills-upstream.ts` and run:",
    "",
    "```sh",
    "bun run script/sync-skills.ts",
    "```",
    "",
    "That refreshes `skills/`, the upstream metadata, and the generated manifest at",
    "`src/skill/skills.gen.ts`.",
    "",
  ].join("\n"),
)

const generated = await generate()
console.log(`Synced ${count} files from ${SKILLS_REPO}@${SKILLS_COMMIT} and generated ${generated.count} entries`)
