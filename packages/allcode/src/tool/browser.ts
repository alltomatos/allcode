import { Effect, Option, Redacted, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import * as Tool from "./tool"
import DESCRIPTION from "./browser.txt"
import { RuntimeFlags } from "@/effect/runtime-flags"

const TIMEOUT = 20 * 1000
const PANEL_ID = "main"

export const Parameters = Schema.Struct({
  action: Schema.Literals([
    "navigate",
    "back",
    "forward",
    "reload",
    "click",
    "type",
    "key",
    "scroll",
    "screenshot",
    "snapshot",
  ]).annotate({ description: "Which browser action to perform" }),
  url: Schema.optional(Schema.String).annotate({ description: "URL to navigate to (action: navigate)" }),
  ref: Schema.optional(Schema.String).annotate({
    description: "Element ref from a prior snapshot, e.g. ref_3 (action: click)",
  }),
  x: Schema.optional(Schema.Number).annotate({ description: "Viewport x coordinate (action: click, if no ref)" }),
  y: Schema.optional(Schema.Number).annotate({ description: "Viewport y coordinate (action: click, if no ref)" }),
  text: Schema.optional(Schema.String).annotate({ description: "Text to type into the focused element (action: type)" }),
  key: Schema.optional(Schema.String).annotate({
    description: "Key to press, e.g. Enter, Tab, Escape (action: key)",
  }),
  deltaX: Schema.optional(Schema.Number).annotate({ description: "Horizontal scroll amount (action: scroll)" }),
  deltaY: Schema.optional(Schema.Number).annotate({ description: "Vertical scroll amount (action: scroll)" }),
})

const NAVIGATION_ACTIONS = new Set(["navigate", "back", "forward", "reload"])

const StateSchema = Schema.Struct({
  url: Schema.String,
  title: Schema.String,
  isLoading: Schema.Boolean,
  canGoBack: Schema.Boolean,
  canGoForward: Schema.Boolean,
})

const SnapshotSchema = Schema.Struct({
  outline: Schema.String,
})

const ErrorBodySchema = Schema.Struct({
  error: Schema.Struct({ code: Schema.String, message: Schema.String }),
})

const decodeErrorBody = Schema.decodeUnknownOption(ErrorBodySchema)

const TIMEOUT_MESSAGE = "The browser did not respond in time. The page may still be loading; try again."

export function describeBrowserFailure(status: number, body: unknown): string {
  const decoded = decodeErrorBody(body)
  if (Option.isSome(decoded)) return decoded.value.error.message
  if (status === 404) return "The browser panel is not available in this window. Open the desktop app and try again."
  if (status === 401 || status === 403) return "The browser rejected the request. Restart the desktop app and try again."
  if (status === 504) return TIMEOUT_MESSAGE
  return "The browser could not complete this action. Try again."
}

export const BrowserTool = Tool.define(
  "browser",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const flags = yield* RuntimeFlags.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const port = flags.browserBridgePort
          const token = flags.browserBridgeToken
          if (Option.isNone(port) || Option.isNone(token)) {
            throw new Error("The browser tool is only available inside the opencode desktop app.")
          }
          const baseUrl = `http://127.0.0.1:${port.value}/panels/${PANEL_ID}`
          const headers = { Authorization: `Bearer ${Redacted.value(token.value)}` }

          if (NAVIGATION_ACTIONS.has(params.action)) {
            yield* ctx.ask({
              permission: "browser",
              patterns: [params.url ?? "*"],
              always: [],
              metadata: { action: params.action, url: params.url },
            })
          }

          const execute = (req: HttpClientRequest.HttpClientRequest) =>
            Effect.gen(function* () {
              const response = yield* http.execute(req)
              if (response.status < 200 || response.status >= 300) {
                const body = yield* response.json.pipe(Effect.orElseSucceed(() => undefined))
                throw new Error(describeBrowserFailure(response.status, body))
              }
              return response
            }).pipe(
              Effect.catch(() =>
                Effect.die(new Error("The browser bridge is unavailable. Restart the desktop app and try again.")),
              ),
            )

          const post = (path: string, body: unknown) =>
            Effect.gen(function* () {
              const req = yield* HttpClientRequest.post(`${baseUrl}${path}`).pipe(
                HttpClientRequest.setHeaders(headers),
                HttpClientRequest.bodyJson(body),
              )
              return yield* execute(req)
            }).pipe(
              Effect.timeoutOrElse({ duration: TIMEOUT, orElse: () => Effect.die(new Error(TIMEOUT_MESSAGE)) }),
            )

          const postState = (path: string, body?: unknown) =>
            Effect.gen(function* () {
              const response = yield* post(path, body ?? {})
              return yield* HttpClientResponse.schemaBodyJson(StateSchema)(response).pipe(
                Effect.catch(() => Effect.die(new Error("The browser returned an unexpected response. Try again."))),
              )
            })

          const get = (path: string) =>
            execute(HttpClientRequest.get(`${baseUrl}${path}`).pipe(HttpClientRequest.setHeaders(headers))).pipe(
              Effect.timeoutOrElse({ duration: TIMEOUT, orElse: () => Effect.die(new Error(TIMEOUT_MESSAGE)) }),
            )

          switch (params.action) {
            case "navigate": {
              if (!params.url) throw new Error("navigate requires a url")
              const state = yield* postState("/navigate", { url: params.url })
              return { output: `Navigated to ${state.url} — "${state.title}"`, title: state.title, metadata: {} }
            }
            case "back": {
              const state = yield* postState("/back")
              return { output: `Went back to ${state.url}`, title: state.title, metadata: {} }
            }
            case "forward": {
              const state = yield* postState("/forward")
              return { output: `Went forward to ${state.url}`, title: state.title, metadata: {} }
            }
            case "reload": {
              const state = yield* postState("/reload")
              return { output: `Reloaded ${state.url}`, title: state.title, metadata: {} }
            }
            case "click": {
              if (!params.ref && (params.x === undefined || params.y === undefined))
                throw new Error("click requires either ref or x/y")
              yield* post("/click", { ref: params.ref, x: params.x, y: params.y })
              return { output: "Clicked", title: "Browser click", metadata: {} }
            }
            case "type": {
              if (!params.text) throw new Error("type requires text")
              yield* post("/type", { text: params.text })
              return { output: `Typed "${params.text}"`, title: "Browser type", metadata: {} }
            }
            case "key": {
              if (!params.key) throw new Error("key requires a key name")
              yield* post("/key", { key: params.key })
              return { output: `Pressed ${params.key}`, title: "Browser key", metadata: {} }
            }
            case "scroll": {
              yield* post("/scroll", { deltaX: params.deltaX ?? 0, deltaY: params.deltaY ?? 0 })
              return { output: "Scrolled", title: "Browser scroll", metadata: {} }
            }
            case "snapshot": {
              const response = yield* get("/snapshot")
              const result = yield* HttpClientResponse.schemaBodyJson(SnapshotSchema)(response).pipe(
                Effect.catch(() => Effect.die(new Error("The browser returned an unexpected page snapshot. Try again."))),
              )
              return { output: result.outline, title: "Page snapshot", metadata: {} }
            }
            case "screenshot": {
              const response = yield* get("/screenshot")
              const arrayBuffer = yield* response.arrayBuffer.pipe(
                Effect.catch(() => Effect.die(new Error("The screenshot could not be read. Try again."))),
              )
              const base64 = Buffer.from(arrayBuffer).toString("base64")
              return {
                title: "Browser screenshot",
                output: "Screenshot captured",
                metadata: {},
                attachments: [{ type: "file" as const, mime: "image/png", url: `data:image/png;base64,${base64}` }],
              }
            }
            default:
              throw new Error("Unsupported browser action.")
          }
        }).pipe(Effect.orDie),
    }
  }),
)
