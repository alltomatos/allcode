import { Schema } from "effect"

export const WhatsAppNativeState = Schema.Literals([
  "idle",
  "connecting",
  "qr_ready",
  "paired",
  "connected",
  "disconnected",
  "error",
])
export type WhatsAppNativeState = Schema.Schema.Type<typeof WhatsAppNativeState>

export const WhatsAppNativeStatus = Schema.Struct({
  agentId: Schema.String,
  state: WhatsAppNativeState,
  meJid: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
  connectedAt: Schema.optional(Schema.Number),
  lastError: Schema.optional(Schema.String),
  autoStart: Schema.optional(Schema.Boolean),
}).annotate({ identifier: "WhatsAppNativeStatus" })
export type WhatsAppNativeStatus = Schema.Schema.Type<typeof WhatsAppNativeStatus>

export const WhatsAppNativeEvent = Schema.Struct({
  agentId: Schema.String,
  state: WhatsAppNativeState,
  qr: Schema.optional(Schema.String),
  ttlMs: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
}).annotate({ identifier: "WhatsAppNativeEvent" })
export type WhatsAppNativeEvent = Schema.Schema.Type<typeof WhatsAppNativeEvent>

export class WhatsAppNativeNotConfiguredError extends Schema.TaggedErrorClass<WhatsAppNativeNotConfiguredError>()(
  "WhatsAppNativeNotConfiguredError",
  {
    message: Schema.String,
    agentId: Schema.String,
  },
) {}

export class WhatsAppNativeStateError extends Schema.TaggedErrorClass<WhatsAppNativeStateError>()(
  "WhatsAppNativeStateError",
  {
    message: Schema.String,
    agentId: Schema.String,
  },
) {}

export class WhatsAppNativeOperationError extends Schema.TaggedErrorClass<WhatsAppNativeOperationError>()(
  "WhatsAppNativeOperationError",
  {
    message: Schema.String,
    agentId: Schema.String,
  },
) {}
