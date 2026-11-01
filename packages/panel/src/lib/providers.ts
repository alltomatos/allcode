import type { ProviderHeader, ProviderModel } from "./store"

/** Providers the desktop already knows about, offered as one-click catalog entries. */
export const BUILTIN_PROVIDERS = [
  { providerID: "anthropic", displayName: "Anthropic" },
  { providerID: "openai", displayName: "OpenAI" },
  { providerID: "google", displayName: "Google" },
  { providerID: "google-antigravity", displayName: "Google Antigravity" },
  { providerID: "openrouter", displayName: "OpenRouter" },
  { providerID: "opencode", displayName: "AllCode Zen" },
  { providerID: "opencode-go", displayName: "AllCode Go" },
  { providerID: "omnrt", displayName: "Omniroute" },
] as const

export type BuiltinProvider = (typeof BUILTIN_PROVIDERS)[number]

export const PROVIDER_ID = /^[a-z0-9][a-z0-9-_]*$/
export const CUSTOM_PROVIDER_NPM = "@ai-sdk/openai-compatible"

/** Presets for centralized proxies aggregating multiple accounts and upstream AI models. */
export const PROXY_PRESETS = [
  {
    presetID: "9router",
    providerID: "9router",
    displayName: "9router",
    npm: "@ai-sdk/openai-compatible",
    baseURL: "http://127.0.0.1:20128/v1",
    models: [
      { id: "auto", name: "Auto (Fastest/Reliable)" },
      { id: "claude-sonnet-4-5-thinking", name: "Claude Sonnet 4.5 Thinking" },
      { id: "claude-opus-4-5-thinking", name: "Claude Opus 4.5 Thinking" },
      { id: "gemini-3-flash", name: "Gemini 3 Flash" },
      { id: "deepseek-chat", name: "DeepSeek V3 / R1" },
    ],
  },
  {
    presetID: "omniroute",
    providerID: "omniroute",
    displayName: "OmniRoute",
    npm: "@ai-sdk/openai-compatible",
    baseURL: "http://127.0.0.1:20128/v1",
    models: [
      { id: "auto", name: "Auto-Combo" },
      { id: "claude-sonnet-4-5-thinking", name: "Claude Sonnet 4.5 Thinking" },
      { id: "claude-opus-4-5-thinking", name: "Claude Opus 4.5 Thinking" },
      { id: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro" },
      { id: "gemini-3-flash", name: "Gemini 3 Flash" },
    ],
  },
] as const

export type ProxyPreset = (typeof PROXY_PRESETS)[number]

export function isBuiltinProviderID(providerID: string) {
  return BUILTIN_PROVIDERS.some((entry) => entry.providerID === providerID)
}

export function sanitizeModels(input: unknown): ProviderModel[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((value) => {
    if (typeof value !== "object" || value === null) return []
    const record = value as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const name = typeof record.name === "string" ? record.name.trim() : ""
    if (!id) return []
    return [{ id, name: name || id }]
  })
}

export function sanitizeHeaders(input: unknown): ProviderHeader[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((value) => {
    if (typeof value !== "object" || value === null) return []
    const record = value as Record<string, unknown>
    const key = typeof record.key === "string" ? record.key.trim() : ""
    const value_ = typeof record.value === "string" ? record.value.trim() : ""
    if (!key) return []
    return [{ key, value: value_ }]
  })
}

export function sanitizeEnv(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((value) => {
    if (typeof value !== "string") return []
    const name = value.trim()
    return name ? [name] : []
  })
}

export function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://")
}

export function validProviderID(providerID: string) {
  return PROVIDER_ID.test(providerID)
}
