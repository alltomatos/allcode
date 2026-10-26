import { proto } from "zapo-js"
import { getWhatsAppNativeStore } from "./store"

/**
 * Leitura do histórico local (mailbox SQLite do `zapo`).
 *
 * O `zapo` guarda cada mensagem como proto serializado (`messageBytes`) por
 * thread. Aqui decodificamos apenas o suficiente para exibição: texto/caption
 * e o tipo da mensagem. Falhas de decode não derrubam a leitura — a mensagem
 * aparece só com metadados.
 */

export interface StoredMessage {
  id: string
  chatId: string
  fromMe: boolean
  senderJid?: string
  participantJid?: string
  timestampMs?: number
  type?: string
  text?: string
}

export interface StoredThread {
  jid: string
  name?: string
  unreadCount?: number
  archived?: boolean
  pinned?: number
}

type ProtoLike = Record<string, unknown>

function decodeMessage(bytes: Uint8Array | undefined): ProtoLike | undefined {
  if (!bytes) return undefined
  try {
    return proto.Message.decode(bytes) as ProtoLike
  } catch {
    return undefined
  }
}

function extractContent(message: ProtoLike | undefined): { type?: string; text?: string } {
  if (!message) return {}
  const key = Object.keys(message).find(
    (field) =>
      message[field] !== null &&
      message[field] !== undefined &&
      field !== "messageContextInfo" &&
      field !== "senderKeyDistributionMessage",
  )
  if (!key) return {}
  const content = message[key] as ProtoLike | undefined
  const text =
    (content?.["text"] as string | undefined) ??
    (content?.["conversation"] as string | undefined) ??
    (content?.["caption"] as string | undefined) ??
    (message["conversation"] as string | undefined)
  return { type: key, text }
}

export async function readMessages(input: {
  agentId: string
  chatId: string
  limit?: number
  beforeTimestampMs?: number
}): Promise<StoredMessage[]> {
  const { store } = await getWhatsAppNativeStore()
  const messages = store.session(input.agentId).messages
  const records = await messages.listByThread(input.chatId, input.limit ?? 20, input.beforeTimestampMs)

  return records.map((record) => {
    const content = extractContent(decodeMessage(record.messageBytes))
    return {
      id: record.id,
      chatId: record.threadJid,
      fromMe: record.fromMe,
      senderJid: record.senderJid,
      participantJid: record.participantJid,
      timestampMs: record.timestampMs,
      type: content.type,
      text: content.text,
    }
  })
}

export async function listThreads(input: { agentId: string; limit?: number }): Promise<StoredThread[]> {
  const { store } = await getWhatsAppNativeStore()
  const threads = store.session(input.agentId).threads
  const records = await threads.list(input.limit ?? 20)
  return records.map((record) => ({
    jid: record.jid,
    name: record.name,
    unreadCount: record.unreadCount,
    archived: record.archived,
    pinned: record.pinned,
  }))
}
