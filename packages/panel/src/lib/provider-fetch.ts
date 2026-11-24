/**
 * Fetches provider models without allowing an upstream redirect chain to loop
 * inside the Cloudflare worker. Only same-host HTTP(S) redirects are followed,
 * and the chain is capped at three hops.
 */
export async function fetchProviderModels(targetUrl: string, headers: Record<string, string>) {
  let current = targetUrl
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(current, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get("location")
    if (!location) return response
    const next = new URL(location, current)
    const origin = new URL(current)
    if (next.host !== origin.host) {
      throw new Error(`Redirecionamento inesperado para ${next.host}`)
    }
    if (next.toString() === current) {
      throw new Error(`Loop de redirecionamento em ${current}`)
    }
    current = next.toString()
  }
  throw new Error("Demasiados redirecionamentos ao contactar o provedor")
}
