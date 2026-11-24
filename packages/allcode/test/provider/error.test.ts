import { describe, expect, test } from "bun:test"
import { ProviderError } from "@/provider/error"

describe("provider stream errors", () => {
  test("retries provider stream errors without a code", () => {
    const messages = [
      "The model is currently at capacity due to high demand. Please try again in a few minutes, or use a higher service tier for priority processing: https://docs.x.ai/developers/advanced-api-usage/priority-processing",
      "The model is temporarily unavailable.",
    ]

    for (const message of messages)
      expect(
        ProviderError.parseStreamError({
          type: "error",
          error: { message },
        }),
      ).toEqual({
        type: "api_error",
        message,
        isRetryable: true,
        responseBody: JSON.stringify({ type: "error", error: { message } }),
      })
  })

  test("classifies interrupted upstream streams from bare gateway envelopes", () => {
    const body = {
      error: {
        type: "api_error",
        code: "upstream_stream_interrupted",
        message: "upstream stream failed",
        retryable: true,
      },
    }

    expect(ProviderError.parseStreamError(body)).toEqual({
      type: "api_error",
      message: "upstream stream failed",
      isRetryable: true,
      responseBody: JSON.stringify(body),
    })
  })

  test("does not opt unknown bare gateway envelopes into retries", () => {
    const body = { error: { message: "no_kv_space" } }

    expect(ProviderError.parseStreamError(body)).toEqual({
      type: "api_error",
      message: "no_kv_space",
      isRetryable: false,
      responseBody: JSON.stringify(body),
    })
  })
})
