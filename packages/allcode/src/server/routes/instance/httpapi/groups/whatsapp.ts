import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { AgentUINotFoundError } from "@/agentui"
import {
  IzapiaGroup,
  IzapiaGroupParticipant,
  IzapiaSession,
  WhatsAppChannelNotConfiguredError,
  WhatsAppInvalidWebhookError,
  WhatsAppProviderApiError,
} from "@/whatsapp"
import {
  WhatsAppNativeStatus,
  WhatsAppNativeNotConfiguredError,
  WhatsAppNativeStateError,
  WhatsAppNativeOperationError,
} from "@/whatsapp-native/schema"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

const root = "/whatsapp"

export const WebhookResponse = Schema.Struct({ ok: Schema.Literal(true) })
export const IzapiaSessionsPayload = Schema.Struct({ apiKey: Schema.String })
export const IzapiaGroupsPayload = Schema.Struct({ apiKey: Schema.String, sids: Schema.Array(Schema.String) })
export const IzapiaGroupParticipantsPayload = Schema.Struct({
  apiKey: Schema.String,
  sid: Schema.String,
  groupId: Schema.String,
})
export const WhatsAppNativeGroup = Schema.Struct({
  jid: Schema.String,
  subject: Schema.String,
  participantCount: Schema.Number,
  isAdmin: Schema.Boolean,
  isSuperAdmin: Schema.Boolean,
  creation: Schema.optional(Schema.Number),
  desc: Schema.optional(Schema.String),
}).annotate({ identifier: "WhatsAppNativeGroup" })
export type WhatsAppNativeGroup = Schema.Schema.Type<typeof WhatsAppNativeGroup>

export const WhatsAppNativeParticipant = Schema.Struct({
  jid: Schema.String,
  name: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
  isAdmin: Schema.Boolean,
  isSuperAdmin: Schema.Boolean,
}).annotate({ identifier: "WhatsAppNativeParticipant" })
export type WhatsAppNativeParticipant = Schema.Schema.Type<typeof WhatsAppNativeParticipant>

export const WhatsAppNativeLogoutResponse = Schema.Struct({ ok: Schema.Literal(true) })

export const WhatsAppApi = HttpApi.make("whatsapp")
  .add(
    HttpApiGroup.make("whatsapp")
      .add(
        // Endpoints WhatsApp Nativo (zapo-js)
        HttpApiEndpoint.get("nativeStatus", `${root}/native/:agentId`, {
          params: { agentId: Schema.String },
          success: described(WhatsAppNativeStatus, "Status da conexão nativa WhatsApp"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.nativeStatus",
            summary: "Get native WhatsApp connection status",
            description: "Returns connection state, connected phone number, and errors for the given agent.",
          }),
        ),
        HttpApiEndpoint.post("nativeConnect", `${root}/native/:agentId/connect`, {
          params: { agentId: Schema.String },
          success: described(WhatsAppNativeStatus, "Conexão nativa iniciada"),
          error: [
            AgentUINotFoundError,
            WhatsAppNativeNotConfiguredError,
            WhatsAppNativeStateError,
            WhatsAppNativeOperationError,
          ],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.nativeConnect",
            summary: "Initiate native WhatsApp pairing/connection",
            description: "Starts WaClient pairing (emitting QR) or connects existing session for this agent.",
          }),
        ),
        HttpApiEndpoint.post("nativeLogout", `${root}/native/:agentId/logout`, {
          params: { agentId: Schema.String },
          success: described(WhatsAppNativeLogoutResponse, "Sessão desconectada com sucesso"),
          error: [WhatsAppNativeOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.nativeLogout",
            summary: "Disconnect native WhatsApp session",
            description: "Logs out the native WhatsApp session and removes credentials.",
          }),
        ),
        HttpApiEndpoint.get("nativeEvents", `${root}/native/:agentId/events`, {
          params: { agentId: Schema.String },
          success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.nativeEvents",
            summary: "Subscribe to native WhatsApp events (SSE)",
            description: "Receives QR codes and connection state changes in real time.",
          }),
        ),
        HttpApiEndpoint.get("nativeGroups", `${root}/native/:agentId/groups`, {
          params: { agentId: Schema.String },
          success: described(Schema.Array(WhatsAppNativeGroup), "Lista de grupos do WhatsApp nativo"),
          error: [WhatsAppNativeOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.nativeGroups",
            summary: "List WhatsApp groups",
            description: "Lists all WhatsApp groups the account belongs to, identifying if it is an admin.",
          }),
        ),
        HttpApiEndpoint.get("nativeGroupParticipants", `${root}/native/:agentId/groups/:groupId/participants`, {
          params: { agentId: Schema.String, groupId: Schema.String },
          success: described(Schema.Array(WhatsAppNativeParticipant), "Lista de participantes do grupo WhatsApp"),
          error: [WhatsAppNativeOperationError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.nativeGroupParticipants",
            summary: "List WhatsApp group participants",
            description: "Lists participants of a specific WhatsApp group in native zapo connection.",
          }),
        ),
        // Called by the WhatsApp gateway (WAHA/Evolution/Z-API/...), never by
        // our own client — deliberately NOT gated by the Authorization
        // middleware every other instance route uses, since an external
        // provider can't present our session credentials. Protected instead
        // by the per-channel `secret` path segment (see
        // ConfigAgentUIV1.WhatsAppChannelBinding.webhookSecret): unguessable,
        // generated once per channel, embedded in the URL handed to the
        // provider. `directory` (which instance/project this agent belongs
        // to) travels the same way, as a query param on that same URL —
        // WorkspaceRoutingMiddleware still needs it to route the request,
        // same as every other instance-scoped endpoint.
        HttpApiEndpoint.post("webhook", `${root}/webhook/:agentId/:secret`, {
          params: { agentId: Schema.String, secret: Schema.String },
          query: WorkspaceRoutingQuery,
          payload: Schema.Unknown,
          success: described(WebhookResponse, "Webhook processed"),
          error: [AgentUINotFoundError, WhatsAppChannelNotConfiguredError, WhatsAppInvalidWebhookError],
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.webhook",
            summary: "Receive a WhatsApp webhook for an AgentUI agent",
            description:
              "Inbound webhook endpoint for the agent's configured WhatsApp channel (via waconector). Never call this directly — it's the URL configured on the WhatsApp gateway itself.",
          }),
        ),
        // Called by our own client (the agent form's "buscar sessões"
        // button) — deliberately not gated by the Authorization middleware
        // either, but for a different reason than the webhook route above:
        // it carries no server-side secret at all, just proxies the caller-
        // supplied `apiKey` straight to izapia's own API. Worst case, a
        // caller who already holds some izapia API key uses this endpoint
        // to list that key's own sessions — nothing an authenticated opencode
        // session wouldn't already let them do directly against izapia.
        HttpApiEndpoint.post("izapiaSessions", `${root}/izapia/sessions`, {
          payload: IzapiaSessionsPayload,
          success: described(Schema.Array(IzapiaSession), "Sessions for this izapia tenant"),
          error: WhatsAppProviderApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.izapiaSessions",
            summary: "List izapia sessions",
            description: "Lists the WhatsApp sessions already created for the tenant that owns the given izapia API key.",
          }),
        ),
        // Same reasoning as izapiaSessions above — no server-side secret,
        // just proxies the caller-supplied credentials.
        HttpApiEndpoint.post("izapiaGroups", `${root}/izapia/groups`, {
          payload: IzapiaGroupsPayload,
          success: described(Schema.Array(IzapiaGroup), "Groups across the given izapia sessions"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.izapiaGroups",
            summary: "List izapia groups",
            description: "Lists WhatsApp groups across the given izapia sessions, deduped by group id.",
          }),
        ),
        HttpApiEndpoint.post("izapiaGroupParticipants", `${root}/izapia/group-participants`, {
          payload: IzapiaGroupParticipantsPayload,
          success: described(Schema.Array(IzapiaGroupParticipant), "Participants in an izapia group"),
          error: WhatsAppProviderApiError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "whatsapp.izapiaGroupParticipants",
            summary: "List izapia group participants",
            description: "Lists participants of a specific izapia WhatsApp group with resolved profile names.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "whatsapp",
          description: "Experimental HttpApi WhatsApp channel webhook route.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )
