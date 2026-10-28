import { LLMEvent, type FinishReason } from "@allcode/llm"
import { Cause, Effect, Exit } from "effect"
import * as Stream from "effect/Stream"

/**
 * Prompt enhancement is a single text-in/text-out operation, but providers do
 * not agree on how that text arrives. This module owns the whole contract:
 * request construction, stream aggregation, finish-reason validation,
 * provider-specific output normalization, and error classification. Both the
 * Antigravity fallback (non-streaming) and the generic LLM runtime feed the
 * same `AttemptResult`, so they cannot drift apart again.
 */

export type Reason =
  | "truncated"
  | "toolCall"
  | "empty"
  | "training"
  | "region"
  | "auth"
  | "rateLimit"
  | "timeout"
  | "modelUnavailable"
  | "unknown"

export type Failure = {
  readonly reason: Reason
  readonly provider: string
  readonly model: string
  readonly message: string
  readonly retryable: boolean
}

export type Outcome = { readonly ok: true; readonly text: string } | { readonly ok: false; readonly error: Failure }

export type AttemptResult = {
  readonly text: string
  readonly finishReason?: FinishReason
}

/**
 * The system prompt is intentionally English. AgentRouter's upstream content
 * filter rejects non-English text, and its local relay only translates message
 * blocks, not the system block. Keeping this prompt in English keeps the
 * enhancement request filter-safe on every provider; the "same language as the
 * user" rule below preserves the user's language in the result.
 */
const SYSTEM_PROMPT = [
  "You are an elite prompt engineer and senior software architect.",
  "Your only job is to understand the conversation context, the memory, and the user's draft, then rewrite the draft into an improved prompt that is clearer, richer in essential technical detail, and more effective for a coding assistant.",
  "",
  "Non-negotiable rules:",
  "1. Return ONLY the text of the improved prompt. Never include preambles, greetings, explanations (such as 'Here is the prompt:', 'Suggestion:', etc.), or surrounding quotes.",
  "2. Strictly preserve the user's language (for example, Brazilian Portuguese if the user wrote in Portuguese).",
  "3. Be direct, precise, and structured. Clearly state the objective, functional requirements, expected behavior, and technical constraints that fit the context.",
  "4. Preserve any command (for example /refactor, /test) or file mention (@path) present in the draft.",
  "5. Do not answer the request or perform the technical task. Only return the improved instruction.",
].join("\n")

const COMPLETION_NOTE =
  "NOTE: Do not call any tool. Reply directly and exclusively with the text of the improved prompt."

export const SYSTEM = [SYSTEM_PROMPT, COMPLETION_NOTE]

export type BuildInput = {
  readonly prompt: string
  readonly context?: readonly string[]
  readonly projectMemory?: string
  readonly globalMemory?: string
}

export function build(input: BuildInput): string {
  const parts: string[] = []
  const context = input.context?.filter((line) => line.trim()).slice(-6) ?? []
  if (context.length > 0) parts.push(`### Recent conversation history:\n${context.join("\n\n")}`)
  const memory = [input.projectMemory, input.globalMemory].filter((value) => value?.trim())
  if (memory.length > 0) parts.push(`### Project memory and context:\n${memory.join("\n")}`)
  parts.push(`### Draft prompt to improve:\n"${input.prompt.trim()}"`)
  return parts.join("\n\n")
}

function stripWrapper(text: string) {
  let value = text.trim()
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    value = value.slice(1, -1).trim()
  }
  if (value.startsWith("```") && value.endsWith("```")) {
    value = value
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/\n?```$/, "")
      .trim()
  }
  return value
}

/**
 * Provider-specific output cleanup. Kept as a table instead of branches at the
 * call site so new providers have one obvious place to be normalized.
 */
const normalizers: Readonly<Record<string, (text: string) => string>> = {
  antigravity: stripWrapper,
  opencode: stripWrapper,
  default: stripWrapper,
}

export function family(provider: string) {
  if (provider.startsWith("google-antigravity")) return "antigravity"
  if (provider.startsWith("opencode")) return "opencode"
  return "default"
}

export function normalize(provider: string, text: string) {
  return (normalizers[family(provider)] ?? normalizers.default)(text)
}

export const classify = (provider: string, model: string, value: unknown): Failure => {
  const message = errorText(value)
  const lower = message.toLowerCase()
  const fail = (reason: Reason, retryable: boolean): Failure => ({
    reason,
    provider,
    model,
    message: message.slice(0, 600) || "The provider did not return a response.",
    retryable,
  })

  if (
    lower.includes("trains on request data") ||
    lower.includes("training on request data") ||
    lower.includes("datapolicy") ||
    lower.includes("data policy")
  )
    return fail("training", false)
  if (lower.includes("hosted in china") || lower.includes("regionnotallowed") || lower.includes("region not allowed"))
    return fail("region", false)
  if (
    lower.includes("no longer supports free models") ||
    lower.includes("free promotion has ended") ||
    lower.includes("trial ended") ||
    lower.includes("model is disabled") ||
    lower.includes("modelnotsupported") ||
    lower.includes("no available channel") ||
    lower.includes("无可用渠道")
  )
    return fail("modelUnavailable", false)
  if (
    lower.includes("invalid api key") ||
    lower.includes("missing api key") ||
    lower.includes("unauthorized") ||
    lower.includes("unauthenticated") ||
    lower.includes("forbidden") ||
    lower.includes("invalid authentication") ||
    /\b401\b/.test(lower) ||
    /\b403\b/.test(lower)
  )
    return fail("auth", false)
  if (
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("ratelimit") ||
    lower.includes("too many requests") ||
    lower.includes("quota") ||
    /\b429\b/.test(lower)
  )
    return fail("rateLimit", true)
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("etimedout") ||
    lower.includes("operation was aborted")
  )
    return fail("timeout", true)
  return fail("unknown", false)
}

function errorText(value: unknown) {
  const raw = (() => {
    if (value instanceof Error) return value.message
    if (typeof value === "string") return value
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  })()
  // Cause.pretty() (and provider SDK errors) append stack frames and source
  // paths. Keep the actual upstream message so the UI can show a concise,
  // structured reason instead of a wall of markup.
  return raw
    .split("\n")
    .filter((line) => !/^\s*at\s/.test(line))
    .filter((line) => !line.includes("node:internal/"))
    .filter((line) => !/^\s*file:\/\//.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

export function fromAI(value: string | undefined): FinishReason | undefined {
  switch (value) {
    case "stop":
    case "length":
    case "content-filter":
    case "tool-calls":
    case "error":
      return value
    default:
      return undefined
  }
}

export const collect = (stream: Stream.Stream<LLMEvent, unknown>): Effect.Effect<AttemptResult, unknown> =>
  Stream.runFold(
    stream,
    () => ({
      text: "",
      finishReason: undefined as FinishReason | undefined,
      providerError: undefined as string | undefined,
    }),
    (state, event) => {
      if (LLMEvent.is.textDelta(event)) return { ...state, text: state.text + event.text }
      if (LLMEvent.is.finish(event)) return { ...state, finishReason: event.reason }
      if (LLMEvent.is.providerError(event)) return { ...state, providerError: event.message }
      return state
    },
  ).pipe(
    Effect.flatMap((state) =>
      state.providerError ? Effect.fail(new Error(state.providerError)) : Effect.succeed(state),
    ),
  )

/**
 * Runs one enhancement attempt and converts every outcome into the same
 * structured result. Partial text is never returned: a `length` finish or a
 * tool call means the caller gets an explicit failure instead of a silent
 * truncation.
 */
export const run = (input: {
  readonly provider: string
  readonly model: string
  readonly attempt: Effect.Effect<AttemptResult, unknown>
}): Effect.Effect<Outcome> =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(input.attempt)
    if (Exit.isFailure(exit)) {
      return { ok: false as const, error: classify(input.provider, input.model, Cause.pretty(exit.cause)) }
    }

    const result = exit.value
    if (result.finishReason === "length") {
      return {
        ok: false as const,
        error: {
          reason: "truncated" as const,
          provider: input.provider,
          model: input.model,
          message: "The model stopped before finishing the response (finish reason: length).",
          retryable: false,
        },
      }
    }
    if (result.finishReason === "tool-calls") {
      return {
        ok: false as const,
        error: {
          reason: "toolCall" as const,
          provider: input.provider,
          model: input.model,
          message: "The model returned a tool call instead of the enhanced prompt.",
          retryable: true,
        },
      }
    }
    if (result.finishReason === "content-filter" || result.finishReason === "error") {
      return {
        ok: false as const,
        error: {
          reason: "modelUnavailable" as const,
          provider: input.provider,
          model: input.model,
          message: `The model did not complete the response (finish reason: ${result.finishReason}).`,
          retryable: false,
        },
      }
    }

    const text = normalize(input.provider, result.text)
    if (!text) {
      return {
        ok: false as const,
        error: {
          reason: "empty" as const,
          provider: input.provider,
          model: input.model,
          message: "The model returned an empty response.",
          retryable: true,
        },
      }
    }
    return { ok: true as const, text }
  })

export * as PromptEnhance from "./prompt-enhance"
