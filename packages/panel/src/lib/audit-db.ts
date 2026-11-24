import postgres from "postgres"
import { toSessionAudit, type SessionAuditRow } from "./audit-mapping"
import { bindings, env } from "./env"
import { EMPTY_USER_KPIS, type ModelUsageSummary, type SessionAudit, type SessionListOptions, type UserKPIs } from "./store"

let sqlClient: ReturnType<typeof postgres> | undefined
let activeConnectionString: string | undefined

export function getAuditSql(): ReturnType<typeof postgres> | null {
  const b = bindings()
  const connStr = b.AUDIT_DB?.connectionString || env("AUDIT_PG_URL", "")

  if (!connStr) return null

  if (!sqlClient || activeConnectionString !== connStr) {
    activeConnectionString = connStr
    sqlClient = postgres(connStr, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      fetch_types: false,
    })
  }

  return sqlClient
}

async function run<T>(job: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T | null> {
  const sql = getAuditSql()
  if (!sql) return null

  try {
    return await job(sql)
  } catch (error) {
    console.error("[audit-db] PostgreSQL query failed:", error instanceof Error ? error.message : error)
    return null
  }
}

export const auditDb = {
  sessions: {
    async create(input: Omit<SessionAudit, "id" | "createdAt">): Promise<SessionAudit | null> {
      return run(async (sql) => {
        const rows = await sql<SessionAuditRow[]>`
          INSERT INTO session_audit (
            session_id, user_id, org_id, title, summary, workspace,
            started_at, ended_at, tokens_total, tokens_input, tokens_output, tokens_reasoning,
            cost_usd, duration_ms, messages_count, model_usage
          ) VALUES (
            ${input.sessionID}, ${input.userID}, ${input.orgID}, ${input.title || null},
            ${input.summary}, ${input.workspace}, ${input.startedAt}, ${input.endedAt || null},
            ${input.tokensTotal}, ${input.tokensInput}, ${input.tokensOutput}, ${input.tokensReasoning},
            ${input.costUsd}, ${input.durationMs}, ${input.messagesCount},
            ${JSON.stringify(input.modelUsage || [])}::jsonb
          )
          RETURNING *
        `

        return rows[0] ? toSessionAudit(rows[0]) : null
      })
    },

    async listByOrg(orgID: string, options: SessionListOptions = {}): Promise<SessionAudit[] | null> {
      return run(async (sql) => {
        const { userID, search, limit = 50, offset = 0 } = options
        const normalizedSearch = search?.trim() ? `%${search.trim()}%` : null

        const rows = await sql<SessionAuditRow[]>`
          SELECT * FROM session_audit
          WHERE org_id = ${orgID}
            ${userID ? sql`AND user_id = ${userID}` : sql``}
            ${normalizedSearch ? sql`AND (title ILIKE ${normalizedSearch} OR summary ILIKE ${normalizedSearch} OR workspace ILIKE ${normalizedSearch})` : sql``}
          ORDER BY started_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `

        return rows.map(toSessionAudit)
      })
    },

    async listByUser(userID: string, limit = 50): Promise<SessionAudit[] | null> {
      return run(async (sql) => {
        const rows = await sql<SessionAuditRow[]>`
          SELECT * FROM session_audit
          WHERE user_id = ${userID}
          ORDER BY started_at DESC
          LIMIT ${limit}
        `

        return rows.map(toSessionAudit)
      })
    },

    async findBySessionID(sessionID: string): Promise<SessionAudit | null | undefined> {
      return run(async (sql) => {
        const rows = await sql<SessionAuditRow[]>`
          SELECT * FROM session_audit
          WHERE session_id = ${sessionID}
          ORDER BY started_at DESC
          LIMIT 1
        `

        return rows[0] ? toSessionAudit(rows[0]) : undefined
      })
    },

    async getOrgKPIs(orgID: string): Promise<UserKPIs | null> {
      return run(async (sql) => {
        const cached = await sql`
          SELECT
            COALESCE(SUM(total_sessions), 0) AS total_sessions,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(total_cost_usd), 0) AS total_cost_usd,
            COALESCE(SUM(total_duration_ms), 0) AS total_duration_ms
          FROM kpi_org_daily
          WHERE org_id = ${orgID}
        `

        if (cached[0] && Number(cached[0].total_sessions) > 0) {
          return {
            ...EMPTY_USER_KPIS,
            totalSessions: Number(cached[0].total_sessions),
            totalTokens: Number(cached[0].total_tokens),
            totalCostUsd: Number(cached[0].total_cost_usd),
            totalDurationMs: Number(cached[0].total_duration_ms),
          }
        }

        const realTime = await sql`
          SELECT
            COUNT(*) AS total_sessions,
            COALESCE(SUM(tokens_total), 0) AS total_tokens,
            COALESCE(SUM(tokens_input), 0) AS tokens_input,
            COALESCE(SUM(tokens_output), 0) AS tokens_output,
            COALESCE(SUM(tokens_reasoning), 0) AS tokens_reasoning,
            COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
            COALESCE(SUM(duration_ms), 0) AS total_duration_ms
          FROM session_audit
          WHERE org_id = ${orgID}
        `

        return {
          ...EMPTY_USER_KPIS,
          totalSessions: Number(realTime[0]?.total_sessions ?? 0),
          totalTokens: Number(realTime[0]?.total_tokens ?? 0),
          tokensInput: Number(realTime[0]?.tokens_input ?? 0),
          tokensOutput: Number(realTime[0]?.tokens_output ?? 0),
          tokensReasoning: Number(realTime[0]?.tokens_reasoning ?? 0),
          totalCostUsd: Number(realTime[0]?.total_cost_usd ?? 0),
          totalDurationMs: Number(realTime[0]?.total_duration_ms ?? 0),
        }
      })
    },

    async getUserKPIs(userID: string): Promise<UserKPIs | null> {
      return run(async (sql) => {
        const realTime = await sql`
          SELECT
            COUNT(*) AS total_sessions,
            COALESCE(SUM(tokens_total), 0) AS total_tokens,
            COALESCE(SUM(tokens_input), 0) AS tokens_input,
            COALESCE(SUM(tokens_output), 0) AS tokens_output,
            COALESCE(SUM(tokens_reasoning), 0) AS tokens_reasoning,
            COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
            COALESCE(SUM(duration_ms), 0) AS total_duration_ms
          FROM session_audit
          WHERE user_id = ${userID}
        `

        return {
          ...EMPTY_USER_KPIS,
          totalSessions: Number(realTime[0]?.total_sessions ?? 0),
          totalTokens: Number(realTime[0]?.total_tokens ?? 0),
          tokensInput: Number(realTime[0]?.tokens_input ?? 0),
          tokensOutput: Number(realTime[0]?.tokens_output ?? 0),
          tokensReasoning: Number(realTime[0]?.tokens_reasoning ?? 0),
          totalCostUsd: Number(realTime[0]?.total_cost_usd ?? 0),
          totalDurationMs: Number(realTime[0]?.total_duration_ms ?? 0),
        }
      })
    },

    async getUserModelUsage(userID: string, options: { days?: number } = {}): Promise<ModelUsageSummary[] | null> {
      return run(async (sql) => {
        const { days = 30 } = options
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

        const rows = await sql<
          Array<{
            provider_id: string
            model_id: string
            tokens: number | string
            cost_usd: number | string
            calls: number | string
            sessions: number | string
          }>
        >`
          SELECT
            mu->>'providerID' AS provider_id,
            mu->>'modelID' AS model_id,
            SUM((mu->>'tokens')::bigint) AS tokens,
            SUM((mu->>'costUsd')::numeric) AS cost_usd,
            SUM((mu->>'calls')::int) AS calls,
            COUNT(DISTINCT session_id) AS sessions
          FROM session_audit,
          LATERAL jsonb_array_elements(model_usage) AS mu
          WHERE user_id = ${userID} AND started_at >= ${cutoff}
          GROUP BY provider_id, model_id
          ORDER BY tokens DESC
        `

        return rows.map((r) => ({
          providerID: r.provider_id,
          modelID: r.model_id,
          tokens: Number(r.tokens ?? 0),
          costUsd: Number(r.cost_usd ?? 0),
          calls: Number(r.calls ?? 0),
          sessions: Number(r.sessions ?? 0),
        }))
      })
    },
  },

  events: {
    async log(event: {
      orgID: string
      actorID?: string
      actorEmail: string
      action: string
      targetType?: string
      targetID?: string
      result: "allow" | "deny"
    }): Promise<void> {
      await run(async (sql) => {
        await sql`
          INSERT INTO audit_event (
            org_id, actor_id, actor_email, action, target_type, target_id, result
          ) VALUES (
            ${event.orgID}, ${event.actorID || null}, ${event.actorEmail}, ${event.action},
            ${event.targetType || null}, ${event.targetID || null}, ${event.result}
          )
        `
      })
    },
  },
}
