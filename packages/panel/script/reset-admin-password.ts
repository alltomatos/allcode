import { generatePassword, hashPassword, passwordHashIsSupported, verifyPassword } from "../src/lib/crypto"

export const SELECT_ADMIN_SQL =
  "SELECT id, email, org_id, status, is_platform_admin, must_change_password, password_hash, last_login_at FROM panel_user WHERE email = ?"

export const SELECT_LOGIN_EVENTS_SQL =
  "SELECT action, at FROM audit_event WHERE target_id = ? OR actor_email = ? ORDER BY at DESC LIMIT 5"

type Statement = { sql: string; params: unknown[] }
type AuditEventInput = { id: string; orgID: string; actorEmail: string; targetID: string; at: string }
type D1Row = Record<string, unknown>
type Mode = "diagnose" | "dry-run" | "reset"

type Config = {
  mode: Mode
  email: string
  operator: string
  accountId: string
  databaseId: string
  apiToken: string
  pgUrl?: string
  newPassword: string
  generatedPassword: boolean
}

export function assertSafeEmail(value: string) {
  const email = value.trim().toLowerCase()
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
    throw new Error("E-mail do administrador inválido; reset abortado.")
  }
  return email
}

export function assertSafeHash(value: string) {
  if (!passwordHashIsSupported(value) || !/^[A-Za-z0-9+/=$]+$/.test(value)) {
    throw new Error("Hash de senha em formato inesperado; reset abortado.")
  }
  return value
}

export function buildResetStatement(hash: string, email: string): Statement {
  return {
    sql: "UPDATE panel_user SET password_hash = ?, must_change_password = 1 WHERE email = ? AND is_platform_admin = 1",
    params: [assertSafeHash(hash), assertSafeEmail(email)],
  }
}

export function buildAuditStatement(event: AuditEventInput): Statement {
  return {
    sql: "INSERT INTO audit_event (id, org_id, actor_id, actor_email, action, target_type, target_id, result, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    params: [
      event.id,
      event.orgID,
      null,
      event.actorEmail,
      "user.password_reset_breakglass",
      "user",
      event.targetID,
      "allow",
      event.at,
    ],
  }
}

function readArgs() {
  const args = process.argv.slice(2)
  const value = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  return {
    diagnose: args.includes("--diagnose"),
    dryRun: args.includes("--dry-run"),
    assumeNoPepper: args.includes("--assume-no-pepper"),
    emailArg: value("--email"),
    operatorArg: value("--operator"),
  }
}

async function readDatabaseId() {
  const text = await Bun.file(new URL("../wrangler.jsonc", import.meta.url)).text()
  const match = text.match(/"database_id"\s*:\s*"([^"]+)"/)
  if (!match?.[1]) throw new Error("Não foi possível ler database_id de wrangler.jsonc; defina D1_DATABASE_ID.")
  return match[1]
}

async function resolveConfig(): Promise<Config> {
  const args = readArgs()
  const email = assertSafeEmail(args.emailArg ?? process.env.PANEL_ADMIN_EMAIL ?? "ronaldodavi@gmail.com")

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID não definido.")
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!apiToken) throw new Error("CLOUDFLARE_API_TOKEN não definido (token de API com permissão D1:Edit).")
  const databaseId = process.env.D1_DATABASE_ID ?? (await readDatabaseId())
  const base = { email, accountId, databaseId, apiToken, pgUrl: process.env.AUDIT_PG_URL }

  if (args.diagnose) {
    return { ...base, mode: "diagnose", operator: "", newPassword: "", generatedPassword: false }
  }

  const operator = (args.operatorArg ?? process.env.PANEL_RESET_OPERATOR ?? "").trim()
  if (!operator) {
    throw new Error("Informe o operador responsável (--operator ou PANEL_RESET_OPERATOR). A ação é privilegiada e exige autoria na auditoria.")
  }

  const pepper = process.env.PANEL_PASSWORD_PEPPER
  if (!args.assumeNoPepper && !pepper) {
    throw new Error(
      "PANEL_PASSWORD_PEPPER não definido. O Worker aplica HMAC-SHA256 com esse segredo antes do PBKDF2; sem o mesmo valor o novo hash nunca será verificado e a conta seguirá bloqueada. " +
        "Passos: 1) rode `bunx wrangler secret list` e veja se PANEL_PASSWORD_PEPPER existe em produção; " +
        "2) se NÃO existir, repita o comando com --assume-no-pepper; " +
        "3) se existir, exporte exatamente o mesmo valor do seu cofre (Cloudflare não permite ler o valor de volta); " +
        "4) se não conseguir recuperá-lo, use o fallback de re-seed do README. " +
        "Dica: `bun run admin:reset-password --diagnose` inspeciona a conta sem exigir pepper e sem alterar nada.",
    )
  }
  process.env.PANEL_PASSWORD_PEPPER = args.assumeNoPepper ? "" : pepper!

  const supplied = process.env.PANEL_RESET_NEW_PASSWORD
  let newPassword: string
  let generatedPassword = false
  if (supplied) {
    if (supplied.length < 16) throw new Error("PANEL_RESET_NEW_PASSWORD deve ter ao menos 16 caracteres.")
    newPassword = supplied
  } else if (process.stdout.isTTY) {
    newPassword = generatePassword(16)
    generatedPassword = true
  } else {
    throw new Error(
      "Saída não interativa: defina PANEL_RESET_NEW_PASSWORD com uma senha forte gerada no seu cofre, ou execute em um terminal interativo para que a senha temporária seja exibida uma única vez.",
    )
  }

  return {
    ...base,
    mode: args.dryRun ? "dry-run" : "reset",
    operator,
    newPassword,
    generatedPassword,
  }
}

async function d1Query(cfg: Config, statement: Statement): Promise<D1Row[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/d1/database/${cfg.databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(statement),
    },
  )
  const payload = (await response.json()) as {
    success?: boolean
    errors?: { message?: string }[]
    result?: { results?: D1Row[] }[]
  }
  if (!response.ok || !payload.success) {
    const reason = payload.errors?.map((error) => error.message).filter(Boolean).join("; ")
    throw new Error(`Falha ao consultar o D1 (HTTP ${response.status})${reason ? `: ${reason}` : ""}.`)
  }
  return payload.result?.[0]?.results ?? []
}

async function pgClient(pgUrl: string) {
  const { default: postgres } = await import("postgres")
  return postgres(pgUrl, { max: 1, connect_timeout: 10, ssl: { rejectUnauthorized: false } })
}

async function pgPreflight(pgUrl: string) {
  const sql = await pgClient(pgUrl)
  try {
    const rows = await sql<{ tbl: string | null }[]>`SELECT to_regclass('public.audit_event') AS tbl`
    if (!rows[0]?.tbl) {
      throw new Error("Tabela audit_event não encontrada no PostgreSQL da VPS; aplique init-audit-schema.sql.")
    }
  } finally {
    await sql.end()
  }
}

async function pgAudit(pgUrl: string, event: AuditEventInput) {
  const sql = await pgClient(pgUrl)
  try {
    await sql`
      INSERT INTO audit_event (org_id, actor_id, actor_email, action, target_type, target_id, result, at)
      VALUES (${event.orgID}, ${null}, ${event.actorEmail}, ${"user.password_reset_breakglass"}, ${"user"}, ${event.targetID}, ${"allow"}, ${event.at}::timestamptz)
    `
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Falha ao registrar auditoria no PostgreSQL da VPS: ${message}. Confira se existe partição de audit_event para o mês corrente (init-audit-schema.sql).`,
    )
  } finally {
    await sql.end()
  }
}

function printDiagnostics(admin: D1Row, events: D1Row[], cfg: Config) {
  const yes = (value: unknown) => (Number(value) === 1 ? "sim" : "não")
  const stored = String(admin.password_hash ?? "")
  console.log(`Diagnóstico (somente leitura) de ${cfg.email}:`)
  console.log(`  conta encontrada no D1: sim`)
  console.log(`  is_platform_admin: ${yes(admin.is_platform_admin)}`)
  console.log(`  status: ${String(admin.status)}`)
  console.log(`  must_change_password: ${yes(admin.must_change_password)}`)
  console.log(`  hash armazenado: ${passwordHashIsSupported(stored) ? "pbkdf2/sha256/100000 (formato suportado)" : "FORMATO DESCONHECIDO"}`)
  console.log(`  último login: ${admin.last_login_at ? String(admin.last_login_at) : "nunca"}`)
  console.log(`  PANEL_PASSWORD_PEPPER neste ambiente: ${process.env.PANEL_PASSWORD_PEPPER ? "definido" : "ausente"} (valor nunca exibido)`)
  console.log("  últimas falhas/sucessos de login auditados:")
  if (events.length === 0) console.log("    (nenhum evento)")
  for (const event of events) console.log(`    ${String(event.at)}  ${String(event.action)}`)
  console.log("")
  console.log("Para decidir o pepper em produção, rode: bunx wrangler secret list")
  console.log("  - sem PANEL_PASSWORD_PEPPER -> use --assume-no-pepper no reset")
  console.log("  - com PANEL_PASSWORD_PEPPER -> exporte o mesmo valor do cofre e rode sem a flag")
  console.log("  - falhas auth.login_failed_bad_password com hash válido -> forte indício de pepper divergente")
  console.log("Nenhuma alteração foi feita.")
}

async function main() {
  const cfg = await resolveConfig()

  const rows = await d1Query(cfg, { sql: SELECT_ADMIN_SQL, params: [cfg.email] })
  const admin = rows[0]
  if (!admin) throw new Error(`Conta ${cfg.email} não encontrada no D1; confirme PANEL_ADMIN_EMAIL de produção.`)

  if (cfg.mode === "diagnose") {
    const events = await d1Query(cfg, { sql: SELECT_LOGIN_EVENTS_SQL, params: [String(admin.id), cfg.email] })
    printDiagnostics(admin, events, cfg)
    return
  }

  if (Number(admin.is_platform_admin) !== 1) {
    throw new Error(`A conta ${cfg.email} não é administrador geral (is_platform_admin != 1); reset abortado por segurança.`)
  }
  const status = String(admin.status)
  if (status === "suspended" || status === "deleted") {
    throw new Error(`A conta ${cfg.email} está com status "${status}". O reset não reativa contas; ajuste o status deliberadamente antes de continuar.`)
  }

  if (cfg.pgUrl) await pgPreflight(cfg.pgUrl)

  const hash = await hashPassword(cfg.newPassword)
  assertSafeHash(hash)
  if (!(await verifyPassword(cfg.newPassword, hash))) {
    throw new Error("O hash gerado não passou na verificação local; abortado para não gravar uma senha inválida.")
  }

  const event: AuditEventInput = {
    id: crypto.randomUUID(),
    orgID: String(admin.org_id),
    actorEmail: cfg.operator,
    targetID: String(admin.id),
    at: new Date().toISOString(),
  }

  console.log(`Pré-validação OK: conta=${cfg.email}, administrador geral, D1 acessível${cfg.pgUrl ? ", PostgreSQL da VPS acessível" : ""}.`)
  if (cfg.mode === "dry-run") {
    console.log("Dry-run: nenhuma alteração foi feita.")
    return
  }

  await d1Query(cfg, buildResetStatement(hash, cfg.email))
  await d1Query(cfg, buildAuditStatement(event))
  if (cfg.pgUrl) await pgAudit(cfg.pgUrl, event)

  const check = await d1Query(cfg, { sql: SELECT_ADMIN_SQL, params: [cfg.email] })
  const persisted = check[0] ? String(check[0].password_hash) : ""
  if (!(await verifyPassword(cfg.newPassword, persisted))) {
    throw new Error("A senha foi gravada, mas a verificação pós-escrita falhou; confirme o PANEL_PASSWORD_PEPPER antes de tentar o login.")
  }

  console.log(`Senha redefinida para ${cfg.email} em ${event.at}.`)
  console.log(`Auditoria registrada: D1 (audit_event, user.password_reset_breakglass)${cfg.pgUrl ? " + PostgreSQL da VPS (audit_event)" : ""}.`)
  if (cfg.generatedPassword) {
    console.log("")
    console.log("Senha temporária (exibida uma única vez; guarde no cofre, não copie para logs nem arquivos):")
    console.log(cfg.newPassword)
  } else {
    console.log("Senha temporária fornecida via PANEL_RESET_NEW_PASSWORD; não foi exibida nem registrada.")
  }
  console.log("")
  console.log("Próximo passo: valide o login em https://allcode.alltomatos.dev.br/ e troque a senha.")
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[reset-admin-password] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
