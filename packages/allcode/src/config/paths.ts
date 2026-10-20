export * as ConfigPaths from "./paths"

import path from "path"
import { Flag } from "@allcode/core/flag/flag"
import { Global } from "@allcode/core/global"
import { Branding } from "@allcode/core/branding"
import { unique } from "remeda"
import * as Effect from "effect/Effect"
import { FSUtil } from "@allcode/core/fs-util"

export const files = Effect.fn("ConfigPaths.projectFiles")(function* (
  name: string,
  directory: string,
  worktree?: string,
) {
  const afs = yield* FSUtil.Service
  const primaryFiles = (yield* afs.up({
    targets: [`${name}.jsonc`, `${name}.json`],
    start: directory,
    stop: worktree,
  })).toReversed()

  // If searching for allcode.json(c) and none found, check legacy opencode.json(c) as non-breaking fallback
  if (primaryFiles.length === 0 && name === Branding.configFileBase) {
    const legacyFiles = (yield* afs.up({
      targets: [`${Branding.legacyConfigFileBase}.jsonc`, `${Branding.legacyConfigFileBase}.json`],
      start: directory,
      stop: worktree,
    })).toReversed()
    if (legacyFiles.length > 0) return legacyFiles
  }

  return primaryFiles
})

export const directories = Effect.fn("ConfigPaths.directories")(function* (directory: string, worktree?: string) {
  const afs = yield* FSUtil.Service
  return unique([
    Global.Path.config,
    ...(!Flag.OPENCODE_DISABLE_PROJECT_CONFIG
      ? yield* afs.up({
          targets: [Branding.configDir, Branding.legacyConfigDir],
          start: directory,
          stop: worktree,
        })
      : []),
    ...(yield* afs.up({
      targets: [Branding.configDir, Branding.legacyConfigDir],
      start: Global.Path.home,
      stop: Global.Path.home,
    })),
    ...(Flag.OPENCODE_CONFIG_DIR ? [Flag.OPENCODE_CONFIG_DIR] : []),
  ])
})

export function fileInDirectory(dir: string, name: string) {
  return [path.join(dir, `${name}.json`), path.join(dir, `${name}.jsonc`)]
}

