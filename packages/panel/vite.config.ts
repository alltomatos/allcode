import { defineConfig, type PluginOption } from "vite"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [
    tailwindcss(),
    solidStart({ middleware: "./src/middleware.ts" }) as PluginOption,
    nitro({
      compatibilityDate: "2025-01-01",
      preset: "cloudflare-module",
      cloudflare: { nodeCompat: true },
    }),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3003,
  },
  worker: {
    format: "es",
  },
})

export const assetDirectory = path.relative(".output/server", ".output/public")
