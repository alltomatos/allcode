#!/usr/bin/env bun
/**
 * Windows-only fix for the pinned @solidjs/start build.
 *
 * That build emits absolute paths with backslashes into define values and
 * generated import specifiers, which are invalid escape sequences for esbuild
 * and Rollup. The repo carries `patches/@solidjs%2Fstart@2.0.0-devinxi.0.patch`
 * for this, but bun does not always apply patches to URL-resolved packages.
 * This script applies the same normalization to the installed copy so local
 * Windows builds keep working. It is idempotent and a no-op elsewhere.
 */
import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

if (process.platform !== "win32") process.exit(0)

const root = path.resolve(import.meta.dir, "..")
const pkg = path.join(root, "node_modules", "@solidjs", "start")
const routerFile = path.join(pkg, "dist", "config", "fs-routes", "router.js")
const configFile = path.join(pkg, "dist", "config", "index.js")

async function patch(file: string, transform: (source: string) => string) {
  let source: string
  try {
    source = await readFile(file, "utf8")
  } catch {
    return false
  }
  const next = transform(source)
  if (next === source) return false
  await writeFile(file, next)
  return true
}

const routerChanged = await patch(routerFile, (source) =>
  source.replaceAll("src = normalize(src);", 'src = src.replace(/\\\\/g, "/");'),
)

const configChanged = await patch(configFile, (source) => {
  let next = source
  if (!next.includes("const slash = (value)")) {
    next = next.replace(
      "const absolute = (path, root) => path ? (isAbsolute(path) ? path : join(root, path)) : path;",
      'const absolute = (path, root) => path ? (isAbsolute(path) ? path : join(root, path)) : path;\nconst slash = (value) => value.replace(/\\\\/g, "/");',
    )
  }
  next = next.replaceAll("normalize(fileURLToPath(", "slash(fileURLToPath(")
  next = next.replace(
    '"import.meta.env.START_APP_ENTRY": `"${appEntryPath}"`,',
    '"import.meta.env.START_APP_ENTRY": JSON.stringify(slash(appEntryPath)),',
  )
  next = next.replace(
    '"import.meta.env.START_CLIENT_ENTRY": `"${handlers.client}"`,',
    '"import.meta.env.START_CLIENT_ENTRY": JSON.stringify(handlers.client),',
  )
  return next
})

if (routerChanged || configChanged) {
  console.log("[panel] patched @solidjs/start for Windows path handling")
}
