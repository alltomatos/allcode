import { describe, expect, test } from "bun:test"
import { ProviderRemoteModalities } from "@/provider/remote-modalities"
import type { Model } from "@/provider/provider"

function model(input: Partial<Record<"text" | "audio" | "image" | "video" | "pdf", boolean>> = {}): Model {
  return {
    id: "m",
    providerID: "ds",
    name: "m",
    family: "",
    api: { id: "m", url: "https://gateway/v1", npm: "@ai-sdk/openai-compatible" },
    status: "active",
    headers: {},
    options: {},
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 0, output: 0 },
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false, ...input },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: "",
    variants: {},
  } as Model
}

describe("provider.remote-modalities.parseModelsPayload", () => {
  test("reads the gateway modalities.input shape", () => {
    const remote = ProviderRemoteModalities.parseModelsPayload({
      data: [{ id: "deepseek-v4.1-flash", modalities: { input: ["text", "image", "pdf"], output: ["text"] } }],
    })

    expect(remote.get("deepseek-v4.1-flash")).toEqual({ input: ["text", "image", "pdf"], output: ["text"] })
  })

  test("reads the input_modalities shape", () => {
    const remote = ProviderRemoteModalities.parseModelsPayload({
      data: [{ id: "gemini-4-argon", input_modalities: ["text", "image", "audio"] }],
    })

    expect(remote.get("gemini-4-argon")).toEqual({ input: ["text", "image", "audio"], output: [] })
  })

  test("drops unknown modalities and keeps the known ones", () => {
    const remote = ProviderRemoteModalities.parseModelsPayload({
      data: [{ id: "x", modalities: { input: ["text", "hologram", "pdf"] } }],
    })

    expect(remote.get("x")?.input).toEqual(["text", "pdf"])
  })

  test("ignores models that do not declare anything", () => {
    const remote = ProviderRemoteModalities.parseModelsPayload({
      data: [{ id: "plain" }, { id: "unknown-only", modalities: { input: ["hologram"] } }, { notAModel: true }],
    })

    expect(remote.size).toBe(0)
  })

  test("tolerates a payload without data", () => {
    expect(ProviderRemoteModalities.parseModelsPayload({}).size).toBe(0)
    expect(ProviderRemoteModalities.parseModelsPayload(null).size).toBe(0)
  })
})

describe("provider.remote-modalities.applyRemoteModalities", () => {
  test("adds the endpoint modalities on top of text", () => {
    const models = { "deepseek-v4.1-flash": model(), "beam-free": model() }
    const remote = new Map([
      ["deepseek-v4.1-flash", { input: ["text", "image", "pdf"], output: ["text"] }],
      ["beam-free", { input: ["text"], output: ["text"] }],
    ])

    const updated = ProviderRemoteModalities.applyRemoteModalities({ models, remote })

    expect(updated).toContain("deepseek-v4.1-flash")
    expect(models["deepseek-v4.1-flash"].capabilities.input).toMatchObject({ text: true, image: true, pdf: true, audio: false })
    expect(models["deepseek-v4.1-flash"].capabilities.attachment).toBe(true)
    expect(models["beam-free"].capabilities.input).toMatchObject({ text: true, image: false, pdf: false })
    expect(models["beam-free"].capabilities.attachment).toBe(false)
  })

  test("never removes a capability the config already declared", () => {
    const models = { "combo/vision": model({ text: true, image: true, video: true, pdf: true }) }
    const remote = new Map([["combo/vision", { input: ["text"], output: ["text"] }]])

    ProviderRemoteModalities.applyRemoteModalities({ models, remote })

    expect(models["combo/vision"].capabilities.input).toMatchObject({ text: true, image: true, video: true, pdf: true })
    expect(models["combo/vision"].capabilities.attachment).toBe(true)
  })

  test("matches by api.id when the model key differs", () => {
    const entry = model()
    entry.api.id = "vendor/model:free"
    const models = { "vendor/model:free": entry }
    const remote = new Map([["vendor/model:free", { input: ["text", "image"], output: ["text"] }]])

    ProviderRemoteModalities.applyRemoteModalities({ models, remote })

    expect(models["vendor/model:free"].capabilities.input.image).toBe(true)
  })

  test("leaves models the endpoint did not list untouched", () => {
    const models = { "not-listed": model() }
    const remote = new Map([["other", { input: ["text", "audio"], output: ["text"] }]])

    const updated = ProviderRemoteModalities.applyRemoteModalities({ models, remote })

    expect(updated).toEqual([])
    expect(models["not-listed"].capabilities.input).toMatchObject({ text: true, audio: false })
  })
})

describe("provider.remote-modalities.fetchRemoteModalities", () => {
  test("sends the bearer token and caches the result", async () => {
    ProviderRemoteModalities.clearRemoteModalitiesCache()
    const calls: Array<{ url: string; authorization?: string }> = []
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      calls.push({ url: String(input), authorization: headers.get("Authorization") ?? undefined })
      return new Response(
        JSON.stringify({ data: [{ id: "m", modalities: { input: ["text", "image"] } }] }),
        { headers: { "Content-Type": "application/json" } },
      )
    }) as unknown as typeof globalThis.fetch

    const first = await ProviderRemoteModalities.fetchRemoteModalities({
      baseURL: "https://gateway/v1/",
      apiKey: "sk-test",
      fetch,
    })
    const second = await ProviderRemoteModalities.fetchRemoteModalities({
      baseURL: "https://gateway/v1",
      apiKey: "sk-test",
      fetch,
    })

    expect(first.get("m")?.input).toEqual(["text", "image"])
    expect(second.get("m")?.input).toEqual(["text", "image"])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ url: "https://gateway/v1/models", authorization: "Bearer sk-test" })
  })

  test("returns an empty map on failure and does not throw", async () => {
    ProviderRemoteModalities.clearRemoteModalitiesCache()
    const fetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof globalThis.fetch

    const result = await ProviderRemoteModalities.fetchRemoteModalities({
      baseURL: "https://gateway/v1",
      fetch,
    })

    expect(result.size).toBe(0)
  })

  test("returns an empty map without a baseURL", async () => {
    const result = await ProviderRemoteModalities.fetchRemoteModalities({ baseURL: "" })
    expect(result.size).toBe(0)
  })
})
