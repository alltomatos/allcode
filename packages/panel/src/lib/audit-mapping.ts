import type { ModelUsageEntry, SessionAudit } from "./store"

export type SessionAuditRow = {
  id: string
  session_id: string
  user_id: string
  org_id: string
  title: string | null
  summary: string
  workspace: string
  started_at: string | Date
  ended_at: string | Date | null
  tokens_total: number | string
  tokens_input: number | string
  tokens_output: number | string
  tokens_reasoning: number | string
  cost_usd: number | string
  duration_ms: number | string
  messages_count: number | string
  model_usage: unknown
  created_at: string | Date
}

function parseModelUsage(value: unknown): ModelUsageEntry[] {
  if (!value) return []
  if (Array.isArray(value)) return value as ModelUsageEntry[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as ModelUsageEntry[]) : []
    } catch {
      return []
    }
  }
  return []
}

function toIso(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function toSessionAudit(row: SessionAuditRow): SessionAudit {
  return {
    id: row.id,
    sessionID: row.session_id,
    userID: row.user_id,
    orgID: row.org_id,
    title: row.title ?? "Sessão sem título",
    summary: row.summary,
    workspace: row.workspace,
    startedAt: toIso(row.started_at) ?? new Date().toISOString(),
    endedAt: toIso(row.ended_at),
    tokensTotal: Number(row.tokens_total ?? 0),
    tokensInput: Number(row.tokens_input ?? 0),
    tokensOutput: Number(row.tokens_output ?? 0),
    tokensReasoning: Number(row.tokens_reasoning ?? 0),
    costUsd: Number(row.cost_usd ?? 0),
    durationMs: Number(row.duration_ms ?? 0),
    messagesCount: Number(row.messages_count ?? 0),
    modelUsage: parseModelUsage(row.model_usage),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  }
}
