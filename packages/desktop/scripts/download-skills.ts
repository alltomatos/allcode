#!/usr/bin/env ts
import { cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"

// Kept as a small manual helper: refresh resources/default-skills from the
// vendored snapshot without running the whole desktop prebuild.
const SOURCE_DIR = path.join(import.meta.dirname, "..", "..", "allcode", "vendor", "skills")
const TARGET_DIR = path.join(import.meta.dirname, "..", "resources", "default-skills")

async function copySkills() {
  await rm(TARGET_DIR, { recursive: true, force: true })
  await mkdir(TARGET_DIR, { recursive: true })
  await cp(SOURCE_DIR, TARGET_DIR, { recursive: true })
  console.log(`Copied vendored skills to ${TARGET_DIR}`)
}

copySkills().catch((error) => {
  console.error(error)
  process.exit(1)
})
