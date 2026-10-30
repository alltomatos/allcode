export {}

import path from "node:path"

const root = await Bun.file("wrangler.jsonc").json()
const generated = {
  ...root,
  main: "index.mjs",
  assets: {
    directory: path.relative(".output/server", ".output/public"),
    binding: "ASSETS",
  },
  d1_databases: root.d1_databases,
  r2_buckets: root.r2_buckets,
  no_bundle: true,
  rules: [{ type: "ESModule", globs: ["**/*.mjs", "**/*.js"] }],
}
await Bun.write(".output/server/wrangler.json", `${JSON.stringify(generated, null, 2)}\n`)
