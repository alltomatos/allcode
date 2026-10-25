import path from "path"
import fs from "fs/promises"
import { Global } from "@allcode/core/global"
import { createSqliteStore } from "@zapo-js/store-sqlite"
import { createStore } from "zapo-js"

export interface WhatsAppNativeStoreInstance {
  readonly dbPath: string
  readonly store: ReturnType<typeof createStore>
}

let storeInstance: WhatsAppNativeStoreInstance | undefined

// Cada profile (dev/prod) tem seu próprio arquivo de credenciais. Compartilhar
// o mesmo SQLite entre a build instalada e a build de dev fazia as duas
// tentarem manter a MESMA sessão do WhatsApp ao mesmo tempo, com a sessão
// sendo invalidada de um lado pelo outro.
export function whatsappNativeProfile(): string {
  const profile = (process.env["OPENCODE_PROFILE"] ?? "").trim().toLowerCase()
  return profile && profile !== "prod" && profile !== "production" ? profile : "prod"
}

export function whatsappNativeDbPath(): string {
  const dir = path.join(Global.Path.data, "whatsapp-native")
  const profile = whatsappNativeProfile()
  return path.join(dir, profile === "prod" ? "state.sqlite" : `state-${profile}.sqlite`)
}

export async function getWhatsAppNativeStore(): Promise<WhatsAppNativeStoreInstance> {
  if (storeInstance) return storeInstance

  const dbPath = whatsappNativeDbPath()
  await fs.mkdir(path.dirname(dbPath), { recursive: true, mode: 0o700 })
  const sqliteBackend = createSqliteStore({
    path: dbPath,
    driver: "auto",
  })

  const store = createStore({
    backends: {
      sqlite: sqliteBackend,
    },
    providers: {
      auth: "sqlite",
      signal: "sqlite",
      preKey: "sqlite",
      session: "sqlite",
      identity: "sqlite",
      senderKey: "sqlite",
      appState: "sqlite",
      privacyToken: "sqlite",
      messages: "sqlite",
      threads: "sqlite",
      contacts: "sqlite",
    },
  })

  storeInstance = { dbPath, store }
  return storeInstance
}
