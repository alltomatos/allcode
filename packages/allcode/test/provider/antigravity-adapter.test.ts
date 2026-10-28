import { describe, expect, test } from "bun:test"
import { unwrapAntigravitySse } from "../../src/provider/antigravity-adapter"

const chunk = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`

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
