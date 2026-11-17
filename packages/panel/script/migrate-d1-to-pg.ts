import fs from "fs"
import postgres from "postgres"

const raw = JSON.parse(fs.readFileSync("d1-clean.json", "utf-8"))
const rows = raw[0]?.results || []
console.log(`Encontradas ${rows.length} sessoes no backup D1.`)

const sql = postgres("postgres://allcode_user:MjVkikUQQdbWf64h6jSErLZaEbpbS5FLi6FbA+diQAI=@144.126.136.170:5432/allcode_audit", {
  ssl: { rejectUnauthorized: false }
})

let inserted = 0
for (const r of rows) {
  try {
    let modelUsageJson = "[]"
    if (r.model_usage) {
      if (typeof r.model_usage === "string") {
        modelUsageJson = r.model_usage
      } else {
        modelUsageJson = JSON.stringify(r.model_usage)
      }
    }

    await sql`
      INSERT INTO session_audit (
        session_id, user_id, org_id, title, summary, workspace,
        started_at, ended_at, tokens_total, tokens_input, tokens_output, tokens_reasoning,
        cost_usd, duration_ms, messages_count, model_usage, created_at
      ) VALUES (
        ${r.session_id}, ${r.user_id}, ${r.org_id}, ${r.title}, ${r.summary}, ${r.workspace},
        ${r.started_at}, ${r.ended_at}, ${r.tokens_total ?? 0}, ${r.tokens_input ?? 0},
        ${r.tokens_output ?? 0}, ${r.tokens_reasoning ?? 0}, ${r.cost_usd ?? 0},
        ${r.duration_ms ?? 0}, ${r.messages_count ?? 0}, ${modelUsageJson}::jsonb, ${r.created_at}
      )
    `
    inserted++
  } catch (err: any) {
    console.error(`Falha ao inserir sessao ${r.session_id}:`, err.message)
  }
}

console.log(`Migradas com sucesso para o PostgreSQL: ${inserted}/${rows.length}`)
await sql.end()
