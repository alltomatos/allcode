import type { ServerConnection } from "@/context/server"
import { authTokenFromCredentials } from "./server"

export type ServerProtocol = "v1" | "v2"

/** Onde o operador fixa a trilha sem depender de um novo release. */
export const PROTOCOL_PREFERENCE_KEY = "opencode.providerProtocol"

function readStoredPreference(): ServerProtocol | undefined {
  const value = globalThis.localStorage?.getItem(PROTOCOL_PREFERENCE_KEY)
  return value === "v1" || value === "v2" ? value : undefined
}

function headers(server: ServerConnection.HttpBase) {
  if (!server.password) return
  return {
    Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
  }
}

async function probe(server: ServerConnection.HttpBase, fetch: typeof globalThis.fetch, path: string) {
  const response = await fetch(new URL(path, server.url), {
    headers: headers(server),
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return
  const value: unknown = await response.json()
  if (!value || typeof value !== "object") return
  return value
}

/**
 * Decide qual trilha de API o cliente usa.
 *
 * - Preferência explícita do operador (`opencode.providerProtocol`) sempre vence:
 *   é o rollback sem release.
 * - Sem preferência, a troca para v2 depende do servidor **anunciar paridade**
 *   em `/api/health` (`providerParity: true`). O anúncio só é ligado quando a
 *   paridade foi comprovada em produção, então um deploy não troca a trilha de
 *   todo mundo de uma vez.
 * - Sem anúncio, v1 continua sendo o padrão.
 */
export async function detectServerProtocol(
  server: ServerConnection.HttpBase,
  fetch: typeof globalThis.fetch,
  readPreference: () => ServerProtocol | undefined = readStoredPreference,
): Promise<ServerProtocol> {
  const preference = readPreference()
  if (preference) return preference

  const current = await probe(server, fetch, "/api/health").catch(() => undefined)
  if (current && "providerParity" in current && current.providerParity === true) return "v2"

  const legacy = await probe(server, fetch, "/global/health").catch(() => undefined)
  if (legacy && "healthy" in legacy && legacy.healthy === true) return "v1"

  if (current && "pid" in current && typeof current.pid === "number") return "v2"
  if (current && "healthy" in current && current.healthy === true) return "v1"
  return "v2"
}
