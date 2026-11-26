import { describe, expect, test } from "bun:test"
import { cleanModel, cleanProvider } from "@allcode/server/handlers/clean"

describe("provider API serialization", () => {
  test("removes credentials and non-serializable settings", () => {
    const provider = cleanProvider({
      id: "custom",
      api: { settings: { apiKey: "secret", accessToken: "token", fetch: () => undefined, baseURL: "https://x" } },
      request: { body: { apiKey: "secret", temperature: 1 } },
    })

    expect(provider.api?.settings as any).toEqual({ baseURL: "https://x" })
    expect(provider.request?.body as any).toEqual({ temperature: 1 })
    expect(JSON.stringify(provider)).not.toContain("secret")
    expect(JSON.stringify(provider)).not.toContain("token")
  })

  test("applies the same redaction to models", () => {
    const model = cleanModel({ api: { settings: { apiKey: "secret" } }, request: { body: { refreshToken: "x" } } })

    expect(model.api?.settings as any).toEqual({})
    expect(model.request?.body as any).toEqual({})
  })
})

