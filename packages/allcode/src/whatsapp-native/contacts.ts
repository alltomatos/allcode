import { existsSync } from "node:fs"
import { whatsappNativeDbPath } from "./store"
import { listThreads } from "./history"

/**
 * Agenda de contatos salvos do WhatsApp.
 *
 * O `zapo` espelha a agenda da conta em `mailbox_contacts` no SQLite nativo
 * (preenchido por history sync e mutações de app-state Contact). O store do
 * zapo só expõe lookup por JID/telefone, então lemos a tabela diretamente para
 * permitir "quem está salvo na agenda?" — que é o que o agente precisa para
 * achar o contato de uma reunião sem o usuário decorar o número.
 */

export interface SavedContact {
  jid: string
  name?: string
  phone?: string
  username?: string
  lid?: string
}

interface ContactRow {
  jid: string
  display_name: string | null
  push_name: string | null
  phone_number: string | null
  username?: string | null
  lid: string | null
}

export function isWhatsAppJid(value: string | undefined): boolean {
  if (!value) return false
  return value.endsWith("@s.whatsapp.net") || value.endsWith("@lid") || value.endsWith("@g.us")
}

export function isUserJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid")
}

/** JID preferido para envio: usa o telefone (PN) quando conhecido. */
export function deliveryJid(contact: SavedContact): string {
  const digits = (contact.phone ?? "").replace(/\D/g, "")
  if (digits) return `${digits}@s.whatsapp.net`
  return contact.jid
}

function digitsOf(value: string | undefined | null): string {
  return (value ?? "").replace(/\D/g, "")
}

function nameOf(row: ContactRow): string | undefined {
  return row.display_name?.trim() || row.push_name?.trim() || undefined
}

function matchesQuery(contact: SavedContact, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const name = contact.name?.toLowerCase() ?? ""
  const username = contact.username?.toLowerCase() ?? ""
  if (name.includes(needle) || username.includes(needle)) return true
  const digits = digitsOf(query)
  if (digits) {
    return digitsOf(contact.phone).includes(digits) || digitsOf(contact.jid).includes(digits)
  }
  return false
}

function readRows(
  db: import("bun:sqlite").Database,
  agentId: string,
  columns: string,
): SavedContact[] {
  const rows = db
    .query(`SELECT ${columns} FROM mailbox_contacts WHERE session_id = ?`)
    .all(agentId) as ContactRow[]

  return rows
    .filter((row) => isUserJid(row.jid))
    .map((row) => ({
      jid: row.jid,
      name: nameOf(row),
      phone: row.phone_number ?? undefined,
      username: row.username ?? undefined,
      lid: row.lid ?? undefined,
    }))
    .filter((contact) => contact.name || contact.phone || contact.username)
}

async function readContactBook(agentId: string): Promise<SavedContact[]> {
  const dbPath = whatsappNativeDbPath()
  if (!existsSync(dbPath)) return []

  const { Database } = await import("bun:sqlite")
  // WAL + leitura concorrente: readonly é o caminho normal; se o SQLite não
  // conseguir abrir assim (ex.: -shm recém-criado), cai para leitura/escrita
  // — não escrevemos nada, só lemos a agenda.
  const db = (() => {
    try {
      return new Database(dbPath, { readonly: true })
    } catch {
      return new Database(dbPath, { create: false })
    }
  })()
  try {
    return readRows(db, agentId, "jid, display_name, push_name, phone_number, username, lid")
  } catch {
    // Bases antigas podem ainda não ter a coluna `username` (migração 0020).
    try {
      return readRows(db, agentId, "jid, display_name, push_name, phone_number, lid")
    } catch {
      return []
    }
  } finally {
    db.close()
  }
}

/** Fallback: conversas conhecidas (quando a agenda ainda não sincronizou). */
async function readFromThreads(agentId: string): Promise<SavedContact[]> {
  const threads = await listThreads({ agentId, limit: 500 })
  return threads
    .filter((thread) => isUserJid(thread.jid))
    .map((thread) => {
      // Só um JID @s.whatsapp.net carrega o telefone (PN). Um @lid é um
      // identificador interno — derivar um PN dele mandaria para o número
      // errado, então mantemos o JID original.
      const phone = thread.jid.endsWith("@s.whatsapp.net") ? digitsOf(thread.jid) || undefined : undefined
      return { jid: thread.jid, name: thread.name?.trim() || undefined, phone }
    })
    .filter((contact) => contact.name || contact.phone)
}

export async function listSavedContacts(input: {
  agentId: string
  limit?: number
  query?: string
}): Promise<SavedContact[]> {
  const book = await readContactBook(input.agentId)
  const contacts = book.length > 0 ? book : await readFromThreads(input.agentId)
  const seen = new Set<string>()

  return contacts
    .filter((contact) => matchesQuery(contact, input.query ?? ""))
    .filter((contact) => {
      const key = digitsOf(contact.phone) || contact.jid
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => (a.name ?? a.phone ?? a.jid).localeCompare(b.name ?? b.phone ?? b.jid))
    .slice(0, input.limit ?? 50)
}

export * as WhatsAppContacts from "./contacts"
