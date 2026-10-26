export * as ConfigAgentUIV1 from "./agentui"

import { Schema, SchemaGetter } from "effect"

export const TelegramChannelBinding = Schema.Struct({
  type: Schema.Literal("telegram"),
  // Per-agent bot token (from @BotFather) — when set, this agent gets its
  // own dedicated Telegram bot/poll loop that responds to every message
  // directly, no command-trigger prefix needed. When absent, the agent
  // stays reachable only through the shared server-wide bot configured in
  // Settings → Integrations, addressed by its commandTriggers prefix (the
  // original, still-supported multiplexed mode from before per-agent
  // tokens existed).
  token: Schema.optional(Schema.String).annotate({
    description: "Dedicated Telegram bot token for this agent (from @BotFather). Leave unset to share the server's global bot instead.",
  }),
  // Which connected project's models/skills/RAG this agent's dedicated bot
  // runs sessions against — same role `directory` plays for the sandbox
  // test chat (see AgentUI.Service.testMessage). Only meaningful when
  // `token` is set.
  directory: Schema.optional(Schema.String).annotate({
    description: "Connected project directory this agent's dedicated bot operates against. Required alongside token.",
  }),
}).annotate({ identifier: "AgentUITelegramChannelBinding" })
export type TelegramChannelBinding = Schema.Schema.Type<typeof TelegramChannelBinding>

// O WhatsApp de um agente pode ser conectado de duas formas estruturalmente
// diferentes, e a distinção é explícita no schema:
//
// - `native`: a lib `zapo-js` mantém a sessão direto com a Meta
//   (WebSocket/Noise), com credenciais persistidas em SQLite local. Não existe
//   webhook, `provider` do waconector nem URL pública envolvidos.
// - `external`: o pacote `waconector` fala com uma API externa (WAHA, Evolution,
//   Z-API, izapia, ...) e recebe mensagens por webhook.
//
// `provider` continua existindo apenas para o modo `external`. Antes de `mode`
// existir, o provider `"zapo"` era usado como se fosse mais um item da lista do
// waconector — o que quebrava o parse da config inteira em qualquer build cujo
// schema só conhecia os providers do waconector (ConfigInvalidError derrubava
// todos os consumidores de config). Hoje `"zapo"` continua sendo aceito na
// leitura, mas é normalizado para `mode: "native"`.
export const WHATSAPP_CONNECTION_MODES = ["external", "native"] as const
export type WhatsAppConnectionMode = (typeof WHATSAPP_CONNECTION_MODES)[number]

// The waconector package (https://alltomatos.github.io/waconector/) wraps 9
// unofficial WhatsApp APIs behind one contract — some self-hosted (need a
// Docker container the user runs themselves), some SaaS (need only an API
// key). Every provider's real required fields differ (see
// packages/opencode/src/whatsapp/index.ts PROVIDER_FIELDS, sourced directly
// from each adapter's shipped .d.ts, not the docs site — which uses
// different factory names than the actual package). `config` is therefore
// untyped here on purpose: validating it against the right shape for the
// selected `provider` is WhatsApp.Service's job, at connect time.
export const WHATSAPP_PROVIDERS = [
  "waha",
  "evolution",
  "zapi",
  "uazapi",
  "whapi",
  "wuzapi",
  "quepasa",
  "wppconnect",
  "izapia",
] as const
export type WhatsAppProvider = (typeof WHATSAPP_PROVIDERS)[number]

// `"zapo"` é aceito na leitura por retrocompatibilidade (configs gravadas antes
// de `mode` existir), mas nunca é um provider do waconector.
const LEGACY_WHATSAPP_PROVIDER = "zapo"

// Valor gravado em `provider` quando o modo é `native`. É só um placeholder de
// compatibilidade: builds antigos exigem um provider do waconector no schema,
// e recusariam a config inteira sem ele. Quem decide o modo é sempre `mode`.
export const WHATSAPP_NATIVE_PROVIDER_PLACEHOLDER = "waha" as const

export const WhatsAppNativeOptions = Schema.Struct({
  autoStart: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the native WhatsApp client automatically connects on server startup.",
  }),
  deviceBrowser: Schema.optional(Schema.String).annotate({
    description: "Custom browser/client name presented to WhatsApp Web multi-device.",
  }),
  deviceOsDisplayName: Schema.optional(Schema.String).annotate({
    description: "Operating system name presented in WhatsApp linked devices.",
  }),
  sendRateLimitPerMinute: Schema.optional(Schema.Number).annotate({
    description: "Maximum outbound messages per minute to prevent account flagging.",
  }),
  allowGroupAdmin: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the agent has administrative operations enabled in groups.",
  }),
  directMessagesEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the agent should respond to private 1:1 direct messages (defaults to true).",
  }),
  groupsEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the agent should respond in groups (defaults to true).",
  }),
  replyToQuoteOrMentionOnly: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the agent in groups only responds if mentioned (@) OR if the user is replying/quoting a message sent by the agent.",
  }),
}).annotate({ identifier: "AgentUIWhatsAppNativeOptions" })
export type WhatsAppNativeOptions = Schema.Schema.Type<typeof WhatsAppNativeOptions>

const WhatsAppChannelBindingInput = Schema.Struct({
  type: Schema.Literal("whatsapp"),
  mode: Schema.optional(Schema.Literals(WHATSAPP_CONNECTION_MODES)).annotate({
    description:
      "'native' conecta direto com a Meta via zapo-js (sem webhook); 'external' usa uma API externa via waconector. Ausente = 'external', exceto quando provider é 'zapo' (legado), que resolve para 'native'.",
  }),
  provider: Schema.optional(Schema.String).annotate({
    description:
      "Externo: qual API do waconector usar (waha, evolution, zapi, uazapi, whapi, wuzapi, quepasa, wppconnect, izapia). Em modo nativo é ignorado (gravamos um placeholder para compatibilidade com builds antigos). Valores desconhecidos são aceitos na leitura para nunca invalidar a config inteira — o erro aparece no diagnóstico do canal.",
  }),
  config: Schema.Record(Schema.String, Schema.String).annotate({
    description: "Provider-specific connection fields (e.g. baseUrl+apiKey for WAHA, instanceId+token for Z-API). Shape depends on `provider`.",
  }),
  // izapia is multi-session per tenant (one API key, several WhatsApp
  // numbers) — this agent can listen on more than one at once. Absent for
  // single-session providers, which keep using `config.sid`/`config.session`
  // instead. When present, it's the source of truth for which sessions this
  // channel is bound to; `config.sid` (if still set from before this field
  // existed) is ignored.
  sessionIds: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "Session IDs this channel listens on, for providers with multiple sessions per tenant (izapia). Absent means single-session (see config.sid).",
  }),
  // Direct messages are always answered; a group is only answered if its
  // JID is listed here. Empty/absent = groups off entirely (DMs only) —
  // the safer default, since a bot answering in every group it's ever
  // added to is rarely what someone wants.
  allowedGroups: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "WhatsApp group JIDs this agent may respond in, in addition to direct messages. Empty/absent means direct messages only.",
  }),
  // Senders allowed to interact with the bot (phone numbers or JIDs).
  // Empty/absent = all senders allowed.
  allowedSenders: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "WhatsApp numbers/JIDs allowed to interact with this agent. Empty/absent means anyone can interact.",
  }),
  // Senders allowed per specific group (groupId -> array of sender numbers/JIDs).
  // When defined for a group, only these senders (plus global allowedSenders) can interact in that group.
  groupAllowedSenders: Schema.optional(Schema.Record(Schema.String, Schema.Array(Schema.String))).annotate({
    description: "Per-group allowed senders mapping (groupId -> sender numbers/JIDs).",
  }),
  // If true, the bot only responds in groups when explicitly mentioned or tagged.
  mentionOnly: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the agent should only respond in groups when explicitly mentioned (@) or quoted.",
  }),
  directory: Schema.optional(Schema.String).annotate({
    description: "Connected project directory this agent's WhatsApp channel operates against.",
  }),
  // Optional custom base URL or tunnel URL used for generating the webhook endpoint
  publicUrl: Schema.optional(Schema.String).annotate({
    description: "Custom base URL or tunnel URL for generating the webhook endpoint (e.g. Tailscale or Tailscale Funnel URL).",
  }),
  // Generated once, embedded in the webhook URL handed to the provider —
  // this inbound endpoint is called by a third-party service (not our own
  // authenticated client), so it can't go through the normal Authorization
  // middleware; this secret is the only thing standing between it and the
  // public internet. Optional for provider: "zapo" (which connects natively via WebSocket/Noise).
  webhookSecret: Schema.optional(Schema.String).annotate({
    description: "Random per-channel secret embedded in the webhook URL — authenticates inbound webhook calls from external providers.",
  }),
  native: Schema.optional(WhatsAppNativeOptions).annotate({
    description: "Options specific to native WhatsApp Web protocol connection (zapo-js). Only used when mode is 'native'.",
  }),
})

// Normaliza a config para a forma canônica:
// - `provider: "zapo"` (legado) vira `mode: "native"`;
// - `mode` ausente com provider do waconector vira `mode: "external"`;
// - modo nativo sempre grava o placeholder de provider + config vazio, para
//   que builds antigos (schema só com providers do waconector) sigam parseando.
function normalizeWhatsAppChannel(
  channel: Schema.Schema.Type<typeof WhatsAppChannelBindingInput>,
): Schema.Schema.Type<typeof WhatsAppChannelBindingInput> {
  const legacyNative = channel.provider === LEGACY_WHATSAPP_PROVIDER
  const mode: WhatsAppConnectionMode = channel.mode ?? (legacyNative ? "native" : "external")
  if (mode === "native") {
    return {
      ...channel,
      mode: "native",
      provider: WHATSAPP_NATIVE_PROVIDER_PLACEHOLDER,
      config: channel.config ?? {},
    }
  }
  const provider = legacyNative || !channel.provider ? WHATSAPP_NATIVE_PROVIDER_PLACEHOLDER : channel.provider
  return { ...channel, mode: "external", provider, config: channel.config ?? {} }
}

export const WhatsAppChannelBinding = WhatsAppChannelBindingInput.pipe(
  Schema.decodeTo(WhatsAppChannelBindingInput, {
    decode: SchemaGetter.transform(normalizeWhatsAppChannel),
    encode: SchemaGetter.passthrough({ strict: false }),
  }),
).annotate({ identifier: "AgentUIWhatsAppChannelBinding" })
export type WhatsAppChannelBinding = Schema.Schema.Type<typeof WhatsAppChannelBinding>

// Modo efetivo de conexão de um canal WhatsApp. Total por construção: qualquer
// valor inesperado cai em `external`, que é o comportamento legado.
export function whatsappMode(channel: {
  readonly mode?: WhatsAppConnectionMode
  readonly provider?: string
}): WhatsAppConnectionMode {
  if (channel.mode === "native") return "native"
  if (channel.mode === "external") return "external"
  return channel.provider === LEGACY_WHATSAPP_PROVIDER ? "native" : "external"
}

export function isNativeWhatsAppChannel(channel: {
  readonly mode?: WhatsAppConnectionMode
  readonly provider?: string
}): boolean {
  return whatsappMode(channel) === "native"
}

export function isExternalWhatsAppChannel(channel: {
  readonly mode?: WhatsAppConnectionMode
  readonly provider?: string
}): boolean {
  return whatsappMode(channel) === "external"
}

export const ChannelBinding = Schema.Union([TelegramChannelBinding, WhatsAppChannelBinding]).annotate({
  identifier: "AgentUIChannelBinding",
})
export type ChannelBinding = Schema.Schema.Type<typeof ChannelBinding>

export const RagSource = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["file", "text", "url"]),
  label: Schema.String.annotate({ description: "Display name for this source in the AgentUI form" }),
  value: Schema.String.annotate({
    description: "For 'file': a path under the RAG storage dir. For 'text': the pasted text itself. For 'url': the URL to fetch.",
  }),
}).annotate({ identifier: "AgentUIRagSource" })
export type RagSource = Schema.Schema.Type<typeof RagSource>

export const Guardrails = Schema.Struct({
  enabled: Schema.Boolean,
  level: Schema.Literals(["basic", "strict"]),
}).annotate({ identifier: "AgentUIGuardrails" })
export type Guardrails = Schema.Schema.Type<typeof Guardrails>

export const Agent = Schema.Struct({
  id: Schema.String.annotate({ description: "Stable identifier for this AgentUI" }),
  name: Schema.String.annotate({ description: "Display name" }),
  personality: Schema.String.annotate({ description: "Custom system prompt describing this agent's role/tone" }),
  // Same encoding ModelPickerV2 already uses: "providerID/modelID" for a
  // direct model, "combo:<id>" to resolve through Combo.Service instead —
  // see packages/app/src/components/model-picker-v2.tsx and
  // packages/opencode/src/combo/index.ts.
  model: Schema.String.annotate({
    description: "'providerID/modelID' for a direct model, or 'combo:<id>' to resolve through a saved combo",
  }),
  channels: Schema.mutable(Schema.Array(ChannelBinding)).annotate({
    description: "Channels this agent is reachable on",
  }),
  commandTriggers: Schema.mutable(Schema.Array(Schema.String)).annotate({
    description: "Prefixes (e.g. '#', '!') that address this agent on a shared channel — the opencode '/' command prefix stays reserved for the built-in command flow",
  }),
  ragSources: Schema.mutable(Schema.Array(RagSource)).annotate({
    description: "Knowledge sources this agent can retrieve from",
  }),
  guardrails: Guardrails,
  // Names of MCP servers (as configured for `channels[].directory`/the
  // sandbox `directory`) this agent's session is allowed to call tools
  // from — matched by prefix against the sanitized tool names MCP.tools()
  // produces (see McpCatalog.toolName/sanitize). Absent/empty means none:
  // AgentUI sessions are conversational-only by default (see
  // AgentUI.Service.sessionPermission), same as before this field existed.
  mcpServers: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description: "Names of MCP servers this agent is allowed to call tools from. Empty/absent means none.",
  }),
  // Whether this agent is allowed to access and trigger routines (schedules)
  routinesEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this agent has access to query and trigger scheduled routines. Absent/false means disabled.",
  }),
  // Whether this agent is allowed to create and manage reminders/agenda
  agendaEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this agent has access to create and manage agenda reminders. Absent/false means disabled.",
  }),
  // Whether this agent has access to native WhatsApp tools (whatsapp)
  whatsappEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this agent has access to native WhatsApp tools. Absent/false means disabled.",
  }),
  // Pastas locais de mídia que o agente pode listar e enviar (imagens,
  // vídeos, áudios, documentos). Vazio/ausente desliga a tool `media`.
  // A resolução é sempre restrita a estas raízes (sem traversal/symlink escape).
  mediaDirs: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).annotate({
    description:
      "Local folders this agent may browse and send files from (media library). Used by the 'media' tool. Empty/absent means disabled.",
  }),
  // Whether this agent is allowed to use continuous memory (memory_save / memory_search)
  memoryEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this agent has access to persistent memory tools. Absent/false means disabled.",
  }),
  // Whether this agent is allowed to access and edit local files (read, write, edit, glob, grep)
  filesystemEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this agent has access to read, write, edit, and search workspace files. Absent/false means disabled.",
  }),
  // Whether this agent is allowed to execute terminal commands (bash)
  terminalEnabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this agent has access to execute terminal commands (bash). Absent/false means disabled.",
  }),
  // Absent/undefined means enabled — old configs saved before this field
  // existed must keep working exactly as before. Read via isEnabled()
  // below rather than this field directly.
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether this agent is currently reachable on its channels. Missing/undefined means enabled.",
  }),
}).annotate({ identifier: "AgentUIAgent" })
export type Agent = Schema.Schema.Type<typeof Agent>

export function isEnabled(agent: Pick<Agent, "enabled">): boolean {
  return agent.enabled !== false
}

export const Info = Schema.Record(Schema.String, Agent).annotate({ identifier: "AgentUIConfig" })
export type Info = Schema.Schema.Type<typeof Info>
