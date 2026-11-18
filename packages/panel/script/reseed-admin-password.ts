import { fileURLToPath } from "node:url"
import { generatePassword } from "../src/lib/crypto"
import { assertSafeEmail } from "./reset-admin-password"

const PANEL_URL = "https://allcode.alltomatos.dev.br"
const ADMIN_EMAIL = "ronaldodavi@gmail.com"
const DB_NAME = "allcode-panel"
const CWD = fileURLToPath(new URL("..", import.meta.url))

type Row = Record<string, unknown>

type Config = {
  email: string
  operator: string
  dryRun: boolean
  pgUrl?: string
}

function quote(value: string) {
  if (!/^[A-Za-z0-9._%+@:\-]+$/.test(value)) throw new Error(`Valor inseguro para SQL: ${value.slice(0, 40)}`)
  return `'${value}'`
}

function quoteHash(value: string) {
  if (!/^[A-Za-z0-9+/=$]+$/.test(value)) throw new Error("Hash inválido para rollback.")
  return `'${value}'`
}

async function wrangler(args: string[], stdin?: string) {
  const proc = Bun.spawn(["bun", "x", "wrangler", ...args], {
    cwd: CWD,
    stdout: "pipe",
    stderr: "pipe",
    stdin: stdin === undefined ? "ignore" : "pipe",
  })
  if (stdin !== undefined && proc.stdin) {
    proc.stdin.write(stdin + "\n")
    proc.stdin.end()
  }
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (code !== 0) {
    throw new Error(`wrangler ${args[0]} ${args[1] ?? ""} falhou (exit ${code}): ${(err || out).trim().slice(0, 400)}`)
  }
  return out
}

async function d1(sql: string): Promise<Row[]> {
  const out = await wrangler([
    "d1",
    "execute",
    DB_NAME,
    "--remote",
    "--config",
    "wrangler.jsonc",
    "--json",
    "--command",
    sql,
  ])
  const parsed = JSON.parse(out) as { results: Row[]; success: boolean }[]
  return parsed[0]?.results ?? []
}

function resolveConfig(): Config {
  const args = process.argv.slice(2)
  const value = (name: string) => {
    const index = args.indexOf(name)
    return index >= 0 ? args[index + 1] : undefined
  }
  const operator = (value("--operator") ?? process.env.PANEL_RESET_OPERATOR ?? "").trim()
  if (!operator) throw new Error("Informe --operator ou PANEL_RESET_OPERATOR (autoria da auditoria).")
  return {
    email: assertSafeEmail(value("--email") ?? process.env.PANEL_ADMIN_EMAIL ?? ADMIN_EMAIL),
    operator: assertSafeEmail(operator),
    dryRun: args.includes("--dry-run"),
    pgUrl: process.env.AUDIT_PG_URL,
  }
}

function selectAdmin(email: string) {
  return `SELECT id, email, org_id, status, is_platform_admin, must_change_password, password_hash, substr(password_hash,1,26) AS hash_prefix FROM panel_user WHERE email = ${quote(email)}`
}

async function verifyLogin(email: string, password: string) {
  const response = await fetch(`${PANEL_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) return { ok: false, status: response.status, isPlatformAdmin: false }
  const payload = (await response.json()) as { ok?: boolean; user?: { isPlatformAdmin?: boolean } }
  return {
    ok: Boolean(payload.ok),
    status: response.status,
    isPlatformAdmin: Boolean(payload.user?.isPlatformAdmin),
  }
}

async function fireSeedRequests(suffix: string) {
  await fetch(`${PANEL_URL}/login?breakglass=${suffix}`, { cache: "no-store" }).catch(() => {})
  await fetch(`${PANEL_URL}/api/v1/auth/status?email=${encodeURIComponent(ADMIN_EMAIL)}&breakglass=${suffix}`, {
    cache: "no-store",
  }).catch(() => {})
  for (let index = 0; index < 4; index++) {
    await fetch(`${PANEL_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: `breakglass-${suffix}-${index}@invalid.example`, password: "invalid" }),
    }).catch(() => {})
  }
}

async function pgAudit(pgUrl: string, event: { orgID: string; actorEmail: string; targetID: string; at: string }) {
  const { default: postgres } = await import("postgres")
  const sql = postgres(pgUrl, { max: 1, connect_timeout: 10, ssl: { rejectUnauthorized: false } })
  try {
    await sql`
      INSERT INTO audit_event (org_id, actor_id, actor_email, action, target_type, target_id, result, at)
      VALUES (${event.orgID}, ${null}, ${event.actorEmail}, ${"user.password_reset_breakglass"}, ${"user"}, ${event.targetID}, ${"allow"}, ${event.at}::timestamptz)
    `
  } finally {
    await sql.end()
  }
}

async function main() {
  const cfg = resolveConfig()
  const email = quote(cfg.email)

  const current = (await d1(selectAdmin(cfg.email)))[0]
  if (!current) throw new Error(`Conta ${cfg.email} não encontrada no D1.`)
  if (Number(current.is_platform_admin) !== 1) throw new Error("A conta não é administrador geral; abortado.")
  if (String(current.status) !== "active") throw new Error(`Status "${String(current.status)}" não é active; abortado.`)

  const admins = (await d1("SELECT COUNT(*) AS n FROM panel_user WHERE is_platform_admin = 1"))[0]
  if (Number(admins?.n) !== 1) throw new Error("Existe mais de um administrador geral; abortado por segurança.")

  const id = quote(String(current.id))
  const oldPrefix = String(current.hash_prefix)
  const oldHash = quoteHash(String(current.password_hash))
  const oldMustChange = String(Number(current.must_change_password) || 0)
  const tempEmail = quote(`breakglass-${crypto.randomUUID()}@invalid.example`)

  console.log(`Pré-validação OK: conta=${cfg.email}, id=${String(current.id)}, administrador geral único, status=active.`)
  console.log(`Hash atual (prefixo): ${oldPrefix}`)
  if (cfg.dryRun) {
    console.log("Dry-run: nenhuma alteração foi feita (secret, D1 e auditoria intactos).")
    return
  }

  const newPassword = generatePassword(20)
  console.log("")
  console.log("Senha temporária (exibida agora para não se perder em caso de falha; guarde no cofre, não copie para logs/arquivos):")
  console.log(newPassword)
  console.log("")

  console.log("Atualizando PANEL_ADMIN_PASSWORD no Worker...")
  await wrangler(["secret", "put", "PANEL_ADMIN_PASSWORD", "--config", "wrangler.jsonc"], newPassword)
  await Bun.sleep(8000)

  await d1(`UPDATE panel_user SET email = ${tempEmail} WHERE id = ${id} AND is_platform_admin = 1`)

  let succeeded = false
  try {
    for (let attempt = 1; attempt <= 8; attempt++) {
      await d1(`DELETE FROM panel_user WHERE email = ${email} AND id <> ${id}`)
      await fireSeedRequests(`${Date.now()}-${attempt}`)
      const probe = await verifyLogin(cfg.email, newPassword)
      if (probe.ok && probe.isPlatformAdmin) {
        await d1(
          `UPDATE panel_user SET password_hash = (SELECT password_hash FROM panel_user WHERE email = ${email} AND id <> ${id}), must_change_password = 1 WHERE id = ${id}`,
        )
        await d1(`DELETE FROM panel_user WHERE email = ${email} AND id <> ${id}`)
        await d1(`UPDATE panel_user SET email = ${email} WHERE id = ${id}`)
        succeeded = true
        console.log(`Hash validado na tentativa ${attempt} (o seed usou a nova versão do Worker).`)
        break
      }
      console.log(`Tentativa ${attempt}: seed ainda sem a nova senha (HTTP ${probe.status}); repetindo...`)
      await Bun.sleep(4000)
    }
    if (!succeeded) {
      throw new Error("O seed nunca usou a nova versão do Worker em 8 tentativas; rollback aplicado.")
    }
  } catch (error) {
    await d1(`DELETE FROM panel_user WHERE email = ${email} AND id <> ${id}`).catch(() => {})
    await d1(
      `UPDATE panel_user SET email = ${email}, password_hash = ${oldHash}, must_change_password = ${oldMustChange} WHERE id = ${id}`,
    ).catch(() => {})
    throw error
  }

  const final = (await d1(selectAdmin(cfg.email)))[0]
  if (!final) throw new Error("FALHA: conta não encontrada após o re-seed.")
  if (String(final.id) !== String(current.id)) throw new Error("FALHA: id da conta mudou; investigue.")
  if (Number(final.is_platform_admin) !== 1 || String(final.status) !== "active") throw new Error("FALHA: permissões/status alterados.")
  if (String(final.hash_prefix) === oldPrefix) throw new Error("FALHA: o hash não mudou.")
  const after = (await d1("SELECT COUNT(*) AS n FROM panel_user WHERE is_platform_admin = 1"))[0]
  if (Number(after?.n) !== 1) throw new Error("FALHA: mais de um administrador geral após o re-seed.")

  const login = await verifyLogin(cfg.email, newPassword)
  if (!login.ok || !login.isPlatformAdmin) {
    throw new Error(`FALHA na validação final do login (HTTP ${login.status}); o hash foi preservado, repita o procedimento.`)
  }

  const event = {
    orgID: String(current.org_id ?? "org_default"),
    actorEmail: cfg.operator,
    targetID: String(current.id),
    at: new Date().toISOString(),
  }
  await d1(
    `INSERT INTO audit_event (id, org_id, actor_id, actor_email, action, target_type, target_id, result, at) VALUES (${quote(crypto.randomUUID())}, ${quote(event.orgID)}, NULL, ${quote(event.actorEmail)}, 'user.password_reset_breakglass', 'user', ${id}, 'allow', ${quote(event.at)})`,
  )
  if (cfg.pgUrl) {
    await pgAudit(cfg.pgUrl, event).catch((error) => {
      console.error(`Aviso: auditoria no PostgreSQL da VPS falhou: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  console.log("")
  console.log(`Acesso restaurado e validado via POST /api/v1/auth/login (isPlatformAdmin=true) em ${event.at}.`)
  console.log("Auditoria: D1 audit_event (user.password_reset_breakglass)" + (cfg.pgUrl ? " + PostgreSQL da VPS" : "") + ".")
  console.log("")
  console.log(`Valide no navegador: ${PANEL_URL}/login -> redirect /4dm1n.`)
  console.log("Troque a senha no primeiro login (must_change_password = 1).")
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(`[reseed-admin-password] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
