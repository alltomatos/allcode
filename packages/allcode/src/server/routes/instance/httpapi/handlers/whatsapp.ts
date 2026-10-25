import { WhatsApp } from "@/whatsapp"
import { WhatsAppNative } from "@/whatsapp-native"
import { Effect, Queue } from "effect"
import * as Stream from "effect/Stream"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import * as Sse from "effect/unstable/encoding/Sse"
import { InstanceHttpApi } from "../api"

export const whatsappHandlers = HttpApiBuilder.group(InstanceHttpApi, "whatsapp", (handlers) =>
  Effect.gen(function* () {
    const whatsapp = yield* WhatsApp.Service
    const native = yield* WhatsAppNative.Service

    const nativeStatus = Effect.fn("WhatsAppHttpApi.nativeStatus")(function* (ctx: {
      params: { agentId: string }
    }) {
      return yield* native.getStatus(ctx.params.agentId)
    })

    const nativeConnect = Effect.fn("WhatsAppHttpApi.nativeConnect")(function* (ctx: {
      params: { agentId: string }
    }) {
      return yield* native.connect(ctx.params.agentId)
    })

    const nativeLogout = Effect.fn("WhatsAppHttpApi.nativeLogout")(function* (ctx: {
      params: { agentId: string }
    }) {
      yield* native.logout(ctx.params.agentId)
      return { ok: true as const }
    })

    const nativeEvents = Effect.fn("WhatsAppHttpApi.nativeEvents")(function* (ctx: {
      params: { agentId: string }
    }) {
      const stream = Stream.callback<string>((queue) => {
        let cleanupFn: (() => void) | undefined
        return Effect.acquireRelease(
          native.subscribeEvents(ctx.params.agentId, (event) => {
            Queue.offerUnsafe(queue, `data: ${JSON.stringify(event)}\n\n`)
          }).pipe(
            Effect.tap((unsub) => {
              cleanupFn = unsub
              return Effect.void
            }),
          ),
          () => Effect.sync(() => cleanupFn?.()),
        )
      })

      return HttpServerResponse.stream(stream.pipe(Stream.encodeText), {
        contentType: "text/event-stream",
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    })

    const nativeGroups = Effect.fn("WhatsAppHttpApi.nativeGroups")(function* (ctx: {
      params: { agentId: string }
    }) {
      return yield* native.listGroups({ agentId: ctx.params.agentId })
    })

    const nativeGroupParticipants = Effect.fn("WhatsAppHttpApi.nativeGroupParticipants")(function* (ctx: {
      params: { agentId: string; groupId: string }
    }) {
      return yield* native.listGroupParticipants({
        agentId: ctx.params.agentId,
        groupId: ctx.params.groupId,
      })
    })

    // handleRaw, not handle — the payload shape is whatever JSON the
    // selected provider's webhook posts (no fixed schema across 9
    // providers), and we want direct access to the raw request headers to
    // hand straight to waconector's parser.
    const webhook = Effect.fn("WhatsAppHttpApi.webhook")(function* (ctx: {
      params: { agentId: string; secret: string }
      request: HttpServerRequest.HttpServerRequest
    }) {
      const body = yield* Effect.orDie(ctx.request.json)
      const headers: Record<string, string> = { ...ctx.request.headers }
      const result = yield* whatsapp.handleWebhook({
        agentID: ctx.params.agentId,
        secret: ctx.params.secret,
        body,
        headers,
      })
      return HttpServerResponse.jsonUnsafe(result)
    })

    const izapiaSessions = Effect.fn("WhatsAppHttpApi.izapiaSessions")(function* (ctx: {
      payload: { apiKey: string }
    }) {
      return yield* whatsapp.listIzapiaSessions({ apiKey: ctx.payload.apiKey })
    })

    const izapiaGroups = Effect.fn("WhatsAppHttpApi.izapiaGroups")(function* (ctx: {
      payload: { apiKey: string; sids: readonly string[] }
    }) {
      return yield* whatsapp.listIzapiaGroups({ apiKey: ctx.payload.apiKey, sids: [...ctx.payload.sids] })
    })

    const izapiaGroupParticipants = Effect.fn("WhatsAppHttpApi.izapiaGroupParticipants")(function* (ctx: {
      payload: { apiKey: string; sid: string; groupId: string }
    }) {
      return yield* whatsapp.listIzapiaGroupParticipants({
        apiKey: ctx.payload.apiKey,
        sid: ctx.payload.sid,
        groupId: ctx.payload.groupId,
      })
    })

    return handlers
      .handle("nativeStatus", nativeStatus)
      .handle("nativeConnect", nativeConnect)
      .handle("nativeLogout", nativeLogout)
      .handle("nativeGroups", nativeGroups)
      .handle("nativeGroupParticipants", nativeGroupParticipants)
      .handleRaw("nativeEvents", nativeEvents)
      .handleRaw("webhook", webhook)
      .handle("izapiaSessions", izapiaSessions)
      .handle("izapiaGroups", izapiaGroups)
      .handle("izapiaGroupParticipants", izapiaGroupParticipants)
  }),
)
