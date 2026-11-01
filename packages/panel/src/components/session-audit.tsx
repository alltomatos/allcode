import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { formatDate } from "~/lib/labels"
import type { SessionAudit } from "~/lib/store"

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  "google-antigravity": "Google Antigravity",
  "google-antigravity-cli": "Google Antigravity CLI",
  "google-generative-ai": "Google AI",
  openrouter: "OpenRouter",
  omnrt: "OmniRoute",
  agentrouter: "AgentRouter",
  github: "GitHub Copilot",
  "github-copilot": "GitHub Copilot",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  groq: "Groq",
  xai: "xAI",
  azure: "Azure OpenAI",
  bedrock: "AWS Bedrock",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  opencode: "OpenCode",
  "opencode-go": "OpenCode Go",
  kc: "KC",
}

const MODEL_WORDS: Record<string, string> = {
  gpt: "GPT",
  claude: "Claude",
  gemini: "Gemini",
  llama: "Llama",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  mistral: "Mistral",
  sonnet: "Sonnet",
  opus: "Opus",
  haiku: "Haiku",
  flash: "Flash",
  pro: "Pro",
  mini: "Mini",
  lite: "Lite",
  preview: "Preview",
  instruct: "Instruct",
  chat: "Chat",
  coder: "Coder",
  codex: "Codex",
  turbo: "Turbo",
  nano: "Nano",
  o1: "o1",
  o3: "o3",
  o4: "o4",
}

function capitalize(value: string) {
  if (!value) return value
  return value[0].toUpperCase() + value.slice(1)
}

export function providerLabel(id: string): string {
  if (!id) return "—"
  const known = PROVIDER_LABELS[id.toLowerCase()]
  if (known) return known
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map(capitalize)
    .join(" ")
}

export function modelLabel(id: string): string {
  if (!id) return "—"
  const tail = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id
  const parts = tail.split(/[-_]/).filter(Boolean)
  const output: string[] = []
  for (const part of parts) {
    const lower = part.toLowerCase()
    const known = MODEL_WORDS[lower] ?? MODEL_WORDS[part]
    if (known) {
      output.push(known)
      continue
    }
    if (/^\d+$/.test(part) && output.length > 0 && /^\d+(\.\d+)?$/.test(output[output.length - 1])) {
      output[output.length - 1] = `${output[output.length - 1]}.${part}`
      continue
    }
    output.push(capitalize(part))
  }
  return output.join(" ") || id
}

export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0m"
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatTokens(tokens?: number): string {
  if (!tokens || tokens <= 0) return "0"
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`
  return tokens.toString()
}

export function SessionAuditCard(props: {
  session: SessionAudit
  locale: string
  owner?: string
  href?: string
}) {
  const body = () => (
    <>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-semibold text-slate-900">{props.session.title}</span>
            <Show when={props.session.durationMs > 0}>
              <span class="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                ⏱ {formatDuration(props.session.durationMs)}
              </span>
            </Show>
            <Show when={props.owner}>
              <span class="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                {props.owner}
              </span>
            </Show>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 ring-1 ring-indigo-200 ring-inset">
            {formatTokens(props.session.tokensTotal)} tokens
          </span>
          <span class="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200 ring-inset">
            ${props.session.costUsd.toFixed(4)} USD
          </span>
        </div>
      </div>

      <p class="mt-2 line-clamp-4 rounded-lg border border-slate-200/80 bg-white p-2.5 text-xs leading-relaxed whitespace-pre-line text-slate-700">
        {props.session.summary}
      </p>

      <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
        <div class="flex min-w-0 items-center gap-1.5 truncate">
          <span class="text-slate-400">📁</span>
          <span class="truncate font-mono text-slate-700" title={props.session.workspace}>
            {props.session.workspace}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span class="text-slate-400">{formatDate(props.session.startedAt, props.locale)}</span>
          <Show when={props.href}>
            <span class="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600">→</span>
          </Show>
        </div>
      </div>
    </>
  )

  return (
    <Show
      when={props.href}
      fallback={
        <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          {body()}
        </div>
      }
    >
      <A
        href={props.href!}
        class="group block rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-indigo-300 hover:bg-white hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        {body()}
      </A>
    </Show>
  )
}
