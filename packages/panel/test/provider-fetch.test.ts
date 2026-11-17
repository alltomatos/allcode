import { afterEach, describe, expect, test } from "bun:test"
import { fetchProviderModels } from "../src/lib/provider-fetch"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("fetchProviderModels", () => {
  test("follows one same-host redirect instead of looping", async () => {
    const calls: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url === "http://provider.test/v1/models") {
        return new Response(null, { status: 301, headers: { location: "https://provider.test/v1/models" } })
      }
      return new Response(JSON.stringify({ data: [{ id: "model-1" }] }), { status: 200 })
    }) as unknown as typeof fetch

    const response = await fetchProviderModels("http://provider.test/v1/models", {})
    expect(response.status).toBe(200)
    expect(calls).toEqual(["http://provider.test/v1/models", "https://provider.test/v1/models"])
  })

  test("stops a redirect that points to the same URL", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      return new Response(null, { status: 301, headers: { location: String(input) } })
    }) as unknown as typeof fetch

    await expect(fetchProviderModels("https://provider.test/v1/models", {})).rejects.toThrow("Loop de redirecionamento")
  })

  test("rejects cross-host redirects", async () => {
    globalThis.fetch = (async () => {
      return new Response(null, { status: 302, headers: { location: "https://evil.test/v1/models" } })
    }) as unknown as typeof fetch

    await expect(fetchProviderModels("https://provider.test/v1/models", {})).rejects.toThrow("Redirecionamento inesperado")
  })

  test("caps the redirect chain", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      const next = new URL(url.toString())
      next.pathname = `${url.pathname}x`
      return new Response(null, { status: 307, headers: { location: next.toString() } })
    }) as unknown as typeof fetch

    await expect(fetchProviderModels("https://provider.test/v1/models", {})).rejects.toThrow("Demasiados redirecionamentos")
  })
})
