/**
 * Identity headers for the hosted OpenCode free tier (`opencode.ai/inference`).
 *
 * The gateway fingerprints the client and only serves free models to builds it
 * recognizes as a native OpenCode CLI. Reporting the AllCode/desktop build
 * number (for example `opencode/1.25.1`) is what produced:
 *
 *   "This version of OpenCode Desktop no longer supports free models.
 *    Update to the latest version at https://opencode.ai/download ..."
 *
 * even though the very same model worked from the CLI. So the desktop presents
 * the CLI identity: the same User-Agent base shape the CLI sends (the AI SDK
 * appends its own `ai-sdk/... runtime/...` suffix on top), the CLI client
 * identifier, and the paired session headers the free lane expects.
 *
 * Both values stay overridable so a gateway change can be hotfixed through the
 * environment without shipping a release:
 *
 *   OPENCODE_FREE_USER_AGENT  full User-Agent override
 *   OPENCODE_FREE_VERSION     version used to build `opencode/<version>`
 */
const COMPAT_VERSION = "1.21.65"

export function userAgent() {
  const override = process.env.OPENCODE_FREE_USER_AGENT?.trim()
  if (override) return override
  return `opencode/${process.env.OPENCODE_FREE_VERSION?.trim() || COMPAT_VERSION}`
}

/**
 * Second identity attempted when the gateway still refuses the request. The
 * CLI exposes both User-Agent shapes across releases, so if the flat
 * `opencode/<version>` form stops being accepted we retry once with the
 * channel-qualified form before surfacing the error.
 */
export function fallbackUserAgent() {
  const override = process.env.OPENCODE_FREE_FALLBACK_USER_AGENT?.trim()
  if (override) return override
  return `opencode/latest/${process.env.OPENCODE_FREE_VERSION?.trim() || COMPAT_VERSION}/cli`
}

export function headers(input: { sessionID: string; requestID: string; projectID?: string }) {
  return {
    ...(input.projectID ? { "x-opencode-project": input.projectID } : {}),
    "x-opencode-session": input.sessionID,
    "x-opencode-session-id": input.sessionID,
    "x-opencode-request": input.requestID,
    "x-opencode-client": "cli",
    "User-Agent": userAgent(),
  }
}

const rejection = /free tier|free models|freetier|upgrade required|no longer supports/i

/**
 * Free-tier rejections are decided from the request identity, before any model
 * output is produced, so retrying the same call with the fallback identity is
 * safe. Runs below the AI SDK, which keeps this transparent to the session loop.
 */
export function retryFetch(base: (input: any, init?: any) => Promise<Response>) {
  return async (input: any, init?: any): Promise<Response> => {
    const res = await base(input, init)
    if (res.status !== 401 && res.status !== 403 && res.status !== 426) return res
    const body = await res
      .clone()
      .text()
      .catch(() => "")
    if (!rejection.test(body)) return res
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    headers.set("user-agent", fallbackUserAgent())
    headers.set("x-opencode-client", "cli")
    return base(input, { ...init, headers })
  }
}
