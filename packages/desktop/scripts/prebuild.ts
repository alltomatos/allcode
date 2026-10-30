#!/usr/bin/env bun
import { $ } from "bun"
import { cp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"

import { downloadCliToResources, resolveChannel } from "./utils"

const channel = resolveChannel()
const desktopPkg = await Bun.file(join(import.meta.dirname, "..", "package.json")).json()
process.env.OPENCODE_VERSION ??= desktopPkg.version
process.env.OPENCODE_CHANNEL ??= channel

await $`bun ./scripts/copy-icons.ts ${channel}`
await $`bun ./scripts/copy-metainfo.ts ${channel}`

await $`bun build ../mcpmail/src/index.ts --target=node --outfile=./resources/mcpmail/index.js`

await $`cd ../allcode && bun script/build-node.ts`
if (channel === "dev") await downloadCliToResources()

// Bundle the same vendored snapshot the CLI embeds, instead of downloading a
// moving branch. Both products then ship an identical, reproducible skill set.
console.log("Bundling vendored skills for packaging...")
const skillsSource = join(import.meta.dirname, "..", "..", "allcode", "vendor", "skills")
const skillsTarget = join(import.meta.dirname, "..", "resources", "default-skills")
await rm(skillsTarget, { recursive: true, force: true })
await mkdir(skillsTarget, { recursive: true })
await cp(skillsSource, skillsTarget, { recursive: true })
console.log("Copied vendored skills to resources/default-skills")
