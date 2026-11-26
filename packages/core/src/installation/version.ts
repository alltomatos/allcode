import { readFileSync } from "node:fs"
import path from "node:path"

declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
}

/**
 * Release builds inject `OPENCODE_VERSION`. Source runs (and tests) don't, so
 * fall back to the workspace package version instead of a stale hardcoded one.
 */
function sourceVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(path.resolve(import.meta.dir, "../../../../packages/allcode/package.json"), "utf8"),
    ) as { version?: unknown }
    return typeof packageJson.version === "string" ? packageJson.version : undefined
  } catch {
    return undefined
  }
}

export const InstallationVersion =
  typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : (process.env.OPENCODE_VERSION ?? sourceVersion() ?? "0.0.0")
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
