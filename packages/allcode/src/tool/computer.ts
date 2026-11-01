import { Effect, Option, Redacted, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import * as Tool from "./tool"
import DESCRIPTION from "./computer.txt"
import { RuntimeFlags } from "@/effect/runtime-flags"

const TIMEOUT = 20 * 1000

export const Parameters = Schema.Struct({
  action: Schema.Literals(["snapshot", "screenshot", "click", "move", "type", "key", "scroll"]).annotate({
    description: "Which computer action to perform: 'snapshot' (read semantic accessibility tree with refs), 'screenshot' (visual capture), 'click', 'move', 'type', 'key', 'scroll'",
  }),
  ref: Schema.optional(Schema.String).annotate({
    description: "Semantic element ref from a prior snapshot, e.g. ref_3 (action: click, move, type, scroll). Preferred over raw coordinates.",
  }),
  x: Schema.optional(Schema.Number).annotate({ description: "Absolute screen x coordinate (action: click, move, visual fallback)" }),
  y: Schema.optional(Schema.Number).annotate({ description: "Absolute screen y coordinate (action: click, move, visual fallback)" }),
  text: Schema.optional(Schema.String).annotate({ description: "Text to type (action: type)" }),
  key: Schema.optional(Schema.String).annotate({
    description: "Key to press, e.g. Enter, Tab, Escape (action: key)",
  }),
  deltaX: Schema.optional(Schema.Number).annotate({ description: "Horizontal scroll amount (action: scroll)" }),
  deltaY: Schema.optional(Schema.Number).annotate({ description: "Vertical scroll amount (action: scroll)" }),
})

const ActionResponseSchema = Schema.Struct({
  ok: Schema.Boolean,
  delivery: Schema.optional(Schema.String),
  retrySafe: Schema.optional(Schema.Boolean),
  target: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.String),
})

const SnapshotResponseSchema = Schema.Struct({
  ok: Schema.Boolean,
  data: Schema.Struct({
    title: Schema.String,
    app: Schema.String,
    outline: Schema.String,
    elements: Schema.Array(Schema.Unknown),
  }),
})

type ComputerMetadata = {
  title?: string
  app?: string
  elementCount?: number
  delivery?: string
  retrySafe?: boolean
  target?: unknown
}

export const ComputerTool = Tool.define(
  "computer",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const httpOk = HttpClient.filterStatusOk(http)
    const flags = yield* RuntimeFlags.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context): Effect.Effect<Tool.ExecuteResult<ComputerMetadata>> =>
        Effect.gen(function* () {
          const port = flags.computerBridgePort
          const token = flags.computerBridgeToken
          if (Option.isNone(port) || Option.isNone(token)) {
            throw new Error(
              "The computer tool is only available in the opencode desktop app with Computer use enabled in Settings > Experimental.",
            )
          }
          const baseUrl = `http://127.0.0.1:${port.value}`
          const headers = { Authorization: `Bearer ${Redacted.value(token.value)}` }

          yield* ctx.ask({
            permission: "computer",
            patterns: ["*"],
            always: [],
            metadata: { action: params.action, ref: params.ref },
          })

          const post = (path: string, body: unknown) =>
            Effect.gen(function* () {
              const req = yield* HttpClientRequest.post(`${baseUrl}${path}`).pipe(
                HttpClientRequest.setHeaders(headers),
                HttpClientRequest.bodyJson(body),
              )
              const response = yield* httpOk.execute(req)
              return yield* HttpClientResponse.schemaBodyJson(ActionResponseSchema)(response)
            }).pipe(
              Effect.timeoutOrElse({ duration: TIMEOUT, orElse: () => Effect.die(new Error("Computer action timed out")) }),
            )

          switch (params.action) {
            case "snapshot": {
              const response = yield* httpOk
                .execute(HttpClientRequest.get(`${baseUrl}/snapshot`).pipe(HttpClientRequest.setHeaders(headers)))
                .pipe(
                  Effect.timeoutOrElse({ duration: TIMEOUT, orElse: () => Effect.die(new Error("Snapshot timed out")) }),
                )
              const json = yield* HttpClientResponse.schemaBodyJson(SnapshotResponseSchema)(response)
              return {
                title: "Computer snapshot",
                output: json.data.outline,
                metadata: {
                  title: json.data.title,
                  app: json.data.app,
                  elementCount: json.data.elements.length,
                },
              }
            }
            case "click": {
              if (!params.ref && (params.x === undefined || params.y === undefined)) {
                throw new Error("click requires either 'ref' from snapshot or 'x' and 'y' coordinates")
              }
              const res = yield* post("/click", { ref: params.ref, x: params.x, y: params.y })
              const label = params.ref ? `element ${params.ref}` : `(${params.x}, ${params.y})`
              return {
                output: `Clicked at ${label}`,
                title: "Computer click",
                metadata: {
                  delivery: res.delivery ?? "delivered_verified",
                  retrySafe: res.retrySafe ?? false,
                  target: res.target,
                },
              }
            }
            case "move": {
              if (!params.ref && (params.x === undefined || params.y === undefined)) {
                throw new Error("move requires either 'ref' from snapshot or 'x' and 'y' coordinates")
              }
              const res = yield* post("/move", { ref: params.ref, x: params.x, y: params.y })
              const label = params.ref ? `element ${params.ref}` : `(${params.x}, ${params.y})`
              return {
                output: `Moved to ${label}`,
                title: "Computer move",
                metadata: {
                  delivery: res.delivery ?? "delivered_verified",
                  retrySafe: res.retrySafe ?? false,
                  target: res.target,
                },
              }
            }
            case "type": {
              if (!params.text) throw new Error("type requires text")
              const res = yield* post("/type", { text: params.text, ref: params.ref })
              const targetInfo = params.ref ? ` into ${params.ref}` : ""
              return {
                output: `Typed "${params.text}"${targetInfo}`,
                title: "Computer type",
                metadata: {
                  delivery: res.delivery ?? "delivered_verified",
                  retrySafe: res.retrySafe ?? false,
                  target: res.target,
                },
              }
            }
            case "key": {
              if (!params.key) throw new Error("key requires a key name")
              const res = yield* post("/key", { key: params.key })
              return {
                output: `Pressed ${params.key}`,
                title: "Computer key",
                metadata: {
                  delivery: res.delivery ?? "delivered_verified",
                  retrySafe: res.retrySafe ?? false,
                },
              }
            }
            case "scroll": {
              const res = yield* post("/scroll", { deltaX: params.deltaX ?? 0, deltaY: params.deltaY ?? 0, ref: params.ref })
              const targetInfo = params.ref ? ` on ${params.ref}` : ""
              return {
                output: `Scrolled${targetInfo}`,
                title: "Computer scroll",
                metadata: {
                  delivery: res.delivery ?? "delivered_verified",
                  retrySafe: res.retrySafe ?? false,
                },
              }
            }
            case "screenshot": {
              const response = yield* httpOk
                .execute(HttpClientRequest.get(`${baseUrl}/screenshot`).pipe(HttpClientRequest.setHeaders(headers)))
                .pipe(
                  Effect.timeoutOrElse({ duration: TIMEOUT, orElse: () => Effect.die(new Error("Screenshot timed out")) }),
                )
              const arrayBuffer = yield* response.arrayBuffer
              const base64 = Buffer.from(arrayBuffer).toString("base64")
              return {
                title: "Computer screenshot",
                output: "Screenshot captured",
                metadata: {},
                attachments: [{ type: "file" as const, mime: "image/png", url: `data:image/png;base64,${base64}` }],
              }
            }
          }
        }).pipe(Effect.orDie),
    }
  }),
)
