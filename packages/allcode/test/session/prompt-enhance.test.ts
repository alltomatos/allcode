import { describe, expect, test } from "bun:test"
import { LLMEvent } from "@allcode/llm"
import { Effect, Stream } from "effect"
import { PromptEnhance } from "../../src/session/prompt-enhance"

const events = (text: string, reason: "stop" | "length" | "tool-calls" = "stop") => [
  LLMEvent.textDelta({ id: "text-1", text }),
  LLMEvent.finish({ reason }),
]

const stream = (input: ReturnType<typeof events>) => Stream.fromIterable(input)

describe("prompt enhance request", () => {
  test("assembles context, memory, and the draft in a stable order", () => {
    const content = PromptEnhance.build({
      prompt: "  refatore isso  ",
      context: ["User: antes", "Assistant: ok"],
      projectMemory: "projeto x",
      globalMemory: "prefere pt-BR",
    })

    expect(content).toContain("### Recent conversation history:")
    expect(content).toContain("User: antes")
    expect(content).toContain("### Project memory and context:")
    expect(content).toContain("projeto x")
    expect(content).toContain("prefere pt-BR")
    expect(content).toContain('### Draft prompt to improve:\n"refatore isso"')
  })

  test("keeps only the last six context lines", () => {
    const content = PromptEnhance.build({
      prompt: "x",
      context: ["line-1", "line-2", "line-3", "line-4", "line-5", "line-6", "line-7"],
    })
    expect(content).not.toContain("line-1")
    expect(content).toContain("line-2")
    expect(content).toContain("line-7")
  })
})

describe("prompt enhance normalization", () => {
  test("strips surrounding quotes, fences, and whitespace", () => {
    expect(PromptEnhance.normalize("opencode", '  ```markdown\nOlá\n```  ')).toBe("Olá")
    expect(PromptEnhance.normalize("google-antigravity", '"Olá"')).toBe("Olá")
    expect(PromptEnhance.normalize("google-antigravity-cli", "'Olá'")).toBe("Olá")
  })
})

describe("prompt enhance run", () => {
  test("returns the complete text for a successful stream", async () => {
    const outcome = await Effect.runPromise(
      PromptEnhance.run({
        provider: "opencode-go",
        model: "claude-opus-5",
        attempt: PromptEnhance.collect(stream(events("Prompt completo."))),
      }),
    )

    expect(outcome).toEqual({ ok: true, text: "Prompt completo." })
  })

  test("fails instead of returning partial text when finish reason is length", async () => {
    const outcome = await Effect.runPromise(
      PromptEnhance.run({
        provider: "google-antigravity",
        model: "gemini-3.8-flash-high",
        attempt: PromptEnhance.collect(stream(events("Prompt cortado", "length"))),
      }),
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.reason).toBe("truncated")
    expect(outcome.error.provider).toBe("google-antigravity")
    expect(outcome.error.model).toBe("gemini-3.8-flash-high")
  })

  test("fails when the model calls a tool instead of answering", async () => {
    const outcome = await Effect.runPromise(
      PromptEnhance.run({
        provider: "opencode",
        model: "deepseek-v4-flash-free",
        attempt: PromptEnhance.collect(stream(events("", "tool-calls"))),
      }),
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.reason).toBe("toolCall")
  })

  test("fails on an empty response", async () => {
    const outcome = await Effect.runPromise(
      PromptEnhance.run({
        provider: "opencode",
        model: "deepseek-v4-flash-free",
        attempt: PromptEnhance.collect(stream(events(""))),
      }),
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.reason).toBe("empty")
  })

  test("converts a provider error event into a structured failure", async () => {
    const outcome = await Effect.runPromise(
      PromptEnhance.run({
        provider: "opencode-go",
        model: "muse-spark-1.2-contributor",
        attempt: PromptEnhance.collect(
          Stream.make(
            LLMEvent.textDelta({ id: "text-1", text: "partial" }),
            LLMEvent.providerError({ message: "This Go model trains on request data." }),
          ),
        ),
      }),
    )

    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.error.reason).toBe("training")
    expect(outcome.error.retryable).toBe(false)
  })

  test("preserves a successful non-streaming attempt end to end", async () => {
    const outcome = await Effect.runPromise(
      PromptEnhance.run({
        provider: "google-antigravity-cli",
        model: "gemini-3.8-flash-high",
        attempt: Effect.succeed({ text: "  \"Prompt inteiro.\"  ", finishReason: "stop" as const }),
      }),
    )

    expect(outcome).toEqual({ ok: true, text: "Prompt inteiro." })
  })
})

describe("prompt enhance error classification", () => {
  const classify = (message: string, provider = "opencode-go") =>
    PromptEnhance.classify(provider, "model", new Error(message))

  test("detects training policy blocks", () => {
    expect(classify("This Go model trains on request data.").reason).toBe("training")
    expect(classify("DataPolicyError: training required").reason).toBe("training")
  })

  test("detects region, auth, and rate limit failures", () => {
    expect(classify("The latest version of this model is only available hosted in China").reason).toBe("region")
    expect(classify("401 Unauthorized: invalid api key").reason).toBe("auth")
    expect(classify("429 Too Many Requests").reason).toBe("rateLimit")
    expect(classify("429 Too Many Requests").retryable).toBe(true)
    expect(classify("The operation was aborted due to timeout").reason).toBe("timeout")
    expect(classify("The operation was aborted due to timeout").retryable).toBe(true)
  })

  test("detects retired free models", () => {
    expect(classify("This version of OpenCode Desktop no longer supports free models.").reason).toBe(
      "modelUnavailable",
    )
  })

  test("detects upstream routing rejections from AgentRouter", () => {
    expect(classify("503 当前分组 default 下对于模型 claude-opus-5 无可用渠道").reason).toBe("modelUnavailable")
    expect(classify("no available channel for this model").reason).toBe("modelUnavailable")
  })

  test("falls back to unknown with concise detail", () => {
    const failure = classify(`x`.repeat(5000))
    expect(failure.reason).toBe("unknown")
    expect(failure.message.length).toBe(600)
  })

  test("strips stack frames from the reported detail", () => {
    const failure = classify("Error: boom\n    at foo (file:///x.js:1:2)\n    at node:internal/process/task_queues:1")
    expect(failure.message).toBe("Error: boom")
  })
})
