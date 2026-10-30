import { describe, expect, test } from "bun:test"
import { createIdleGuard, createSseTransform, unwrapAntigravitySse } from "../../src/provider/antigravity-adapter"

const chunk = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`

const timing = () => ({
  profile: "ide" as const,
  model: "gemini-3.8-flash-low",
  startedAt: Date.now(),
  lastChunkAt: Date.now(),
  chunks: 0,
  bytes: 0,
  maxGapMs: 0,
})

describe("antigravity SSE unwrap", () => {
  test("merges every streamed text fragment into one candidate", () => {
    const body = [
      chunk({ response: { candidates: [{ content: { role: "model", parts: [{ text: "Melhore " }] } }] } }),
      chunk({ response: { candidates: [{ content: { parts: [{ text: "este " }] } }] } }),
      chunk({
        response: {
          candidates: [{ content: { parts: [{ text: "prompt." }] }, finishReason: "STOP" }],
          usageMetadata: { totalTokenCount: 12 },
        },
      }),
    ].join("")

    const result = unwrapAntigravitySse(body)

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].content.parts).toEqual([
      { text: "Melhore " },
      { text: "este " },
      { text: "prompt." },
    ])
    expect(result.candidates[0].finishReason).toBe("STOP")
    expect(result.usageMetadata).toEqual({ totalTokenCount: 12 })
  })

  test("handles array-shaped chunks and keeps the latest finish reason", () => {
    const body = [
      chunk([
        { response: { candidates: [{ content: { parts: [{ text: "a" }] } }] } },
        { response: { candidates: [{ content: { parts: [{ text: "b" }] } }] } },
      ]),
      chunk({ response: { candidates: [{ content: { parts: [{ text: "c" }] }, finishReason: "MAX_TOKENS" }] } }),
    ].join("")

    const result = unwrapAntigravitySse(body)

    expect(result.candidates[0].content.parts.map((part: { text: string }) => part.text)).toEqual(["a", "b", "c"])
    expect(result.candidates[0].finishReason).toBe("MAX_TOKENS")
  })

  test("ignores malformed and done frames", () => {
    const body = [chunk({ response: { candidates: [{ content: { parts: [{ text: "ok" }] } }] } }), "data: [DONE]\n\n", "data: {bad json}\n\n"].join("")
    expect(unwrapAntigravitySse(body).candidates[0].content.parts).toEqual([{ text: "ok" }])
  })
})

describe("antigravity SSE transform", () => {
  test("reassembles frames split across reads", async () => {
    const encoder = new TextEncoder()
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"response":{"candidates":[{"content":{"parts":[{"text":"a"}]}}]}}\n\nda'))
        controller.enqueue(encoder.encode('ta: {"response":{"candidates":[{"content":{"parts":[{"text":"b"}]}}]}}\n\n'))
        controller.close()
      },
    })

    const text = await new Response(input.pipeThrough(createSseTransform(timing()))).text()
    const frames = text
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)))

    expect(frames).toHaveLength(2)
    expect(frames[0].candidates[0].content.parts).toEqual([{ text: "a" }])
    expect(frames[1].candidates[0].content.parts).toEqual([{ text: "b" }])
  })

  test("flushes a trailing frame that has no final newline", async () => {
    const encoder = new TextEncoder()
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"response":{"candidates":[{"content":{"parts":[{"text":"tail"}]}}]}}'))
        controller.close()
      },
    })

    const text = await new Response(input.pipeThrough(createSseTransform(timing()))).text()
    expect(text).toContain('"text":"tail"')
  })
})

describe("antigravity idle guard", () => {
  test("aborts a stream that never produces another chunk", async () => {
    const stalled = new ReadableStream<Uint8Array>({ start() {} })
    const reader = stalled.pipeThrough(createIdleGuard(20, () => {})).getReader()

    await expect(reader.read()).rejects.toThrow(/stalled/)
  })
})
