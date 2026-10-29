import { describe, expect, test } from "bun:test"
import * as OpencodeCompat from "../../src/session/llm/opencode-compat"

const withEnv = (key: string, value: string | undefined, fn: () => void) => {
  const previous = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env[key]
    else process.env[key] = previous
  }
}

describe("opencode free tier identity", () => {
  test("reports a CLI version instead of the desktop build number", () => {
    withEnv("OPENCODE_FREE_USER_AGENT", undefined, () => {
      withEnv("OPENCODE_FREE_VERSION", undefined, () => {
        expect(OpencodeCompat.userAgent()).toBe("opencode/1.21.65")
      })
    })
  })

  test("allows overriding the reported version", () => {
    withEnv("OPENCODE_FREE_USER_AGENT", undefined, () => {
      withEnv("OPENCODE_FREE_VERSION", "1.22.0", () => {
        expect(OpencodeCompat.userAgent()).toBe("opencode/1.22.0")
      })
    })
  })

  test("allows overriding the full user agent for hotfixes", () => {
    withEnv("OPENCODE_FREE_USER_AGENT", "opencode/latest/2.0.26/cli", () => {
      expect(OpencodeCompat.userAgent()).toBe("opencode/latest/2.0.26/cli")
    })
  })

  test("sends the session pair, project and CLI client identifier", () => {
    const headers = OpencodeCompat.headers({
      sessionID: "ses_0123456789abABCDEFGHIJKLMN",
      requestID: "msg_0123456789abABCDEFGHIJKLMN",
      projectID: "prj_123",
    })
    expect(headers["x-opencode-session"]).toBe("ses_0123456789abABCDEFGHIJKLMN")
    expect(headers["x-opencode-session-id"]).toBe(headers["x-opencode-session"])
    expect(headers["x-opencode-request"]).toBe("msg_0123456789abABCDEFGHIJKLMN")
    expect(headers["x-opencode-project"]).toBe("prj_123")
    expect(headers["x-opencode-client"]).toBe("cli")
    expect(headers["User-Agent"]).toStartWith("opencode/")
  })

  test("omits the project header when there is no project id", () => {
    const headers = OpencodeCompat.headers({ sessionID: "ses_1", requestID: "msg_1" })
    expect("x-opencode-project" in headers).toBe(false)
  })
})

describe("opencode free tier retry", () => {
  const call = async (status: number, body: string) => {
    const seen: (string | null)[] = []
    let calls = 0
    const base = async (_input: unknown, init?: any) => {
      calls++
      seen.push(new Headers(init?.headers).get("user-agent"))
      return new Response(body, { status })
    }
    const response = await OpencodeCompat.retryFetch(base)("https://opencode.ai/inference/openai/v1", {
      method: "POST",
      headers: new Headers({ "user-agent": "opencode/1.25.1", "x-opencode-client": "cli" }),
    })
    return { calls, seen, response }
  }

  test("retries free-tier rejections with the fallback identity", async () => {
    const result = await call(403, '{"type":"error","error":{"type":"FreeTierError"}}')
    expect(result.calls).toBe(2)
    expect(result.seen[1]).toBe(OpencodeCompat.fallbackUserAgent())
    expect(result.response.status).toBe(403)
  })

  test("retries retired-client rejections", async () => {
    const result = await call(
      403,
      "This version of OpenCode Desktop no longer supports free models. Update to the latest version.",
    )
    expect(result.calls).toBe(2)
  })

  test("leaves unrelated errors untouched", async () => {
    const result = await call(403, '{"error":{"message":"forbidden by policy"}}')
    expect(result.calls).toBe(1)
  })

  test("does not retry successful responses", async () => {
    const result = await call(200, "ok")
    expect(result.calls).toBe(1)
  })
})
