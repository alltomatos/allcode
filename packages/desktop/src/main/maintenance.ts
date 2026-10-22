import { stat } from "node:fs/promises"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { app } from "electron"
import { getStore } from "./store"

export type SystemMaintenanceStatus = {
  dbSizeBytes: number
  walSizeBytes: number
  eventCount: number
  largeEventCount: number
  needsMaintenance: boolean
  lastMaintenanceTime?: number
  lastFreedBytes?: number
  lastPurgedEvents?: number
}

export type SystemMaintenanceResult = {
  freedBytes: number
  purgedEvents: number
  durationMs: number
}

const LAST_MAINTENANCE_TIME_KEY = "lastMaintenanceTime"
const LAST_FREED_BYTES_KEY = "lastMaintenanceFreedBytes"
const LAST_PURGED_EVENTS_KEY = "lastMaintenancePurgedEvents"
const PENDING_VACUUM_KEY = "pendingVacuum"

export async function getSystemMaintenanceStatus(): Promise<SystemMaintenanceStatus> {
  const userDataPath = app.getPath("userData")
  const dbPath = process.env.ALLCODE_DB ?? join(userDataPath, "allcode.db")
  const walPath = `${dbPath}-wal`

  let dbSizeBytes = 0
  let walSizeBytes = 0
  let eventCount = 0
  let freeBytesInDb = 0

  try {
    const dbStat = await stat(dbPath).catch(() => null)
    if (dbStat) dbSizeBytes = dbStat.size
  } catch {}

  try {
    const walStat = await stat(walPath).catch(() => null)
    if (walStat) walSizeBytes = walStat.size
  } catch {}

  try {
    const native = new DatabaseSync(dbPath, { readOnly: true })
    try {
      native.exec("PRAGMA busy_timeout = 30000;")
      const countRow = native.prepare("SELECT count(*) as cnt FROM event").get() as { cnt: number } | undefined
      if (countRow) eventCount = countRow.cnt
      const fl = native.prepare("SELECT freelist_count, page_size FROM pragma_freelist_count(), pragma_page_size()").get() as { freelist_count: number; page_size: number } | undefined
      if (fl) freeBytesInDb = (fl.freelist_count ?? 0) * (fl.page_size ?? 4096)
    } finally {
      native.close()
    }
  } catch {}

  // Scanning `length(data)` over a multi-GB event table stalls the main
  // process for tens of seconds. Size and event count already gate
  // maintenance, so this stays a cheap informational zero.
  const largeEventCount = 0

  const store = getStore()
  const lastMaintenanceTime = store.get(LAST_MAINTENANCE_TIME_KEY) as number | undefined
  const lastFreedBytes = store.get(LAST_FREED_BYTES_KEY) as number | undefined
  const lastPurgedEvents = store.get(LAST_PURGED_EVENTS_KEY) as number | undefined

  // Precisa de manutenção se:
  // - Banco físico > 3GB
  // - OU WAL acumulado > 50MB
  // - OU Espaço ocioso desalocado (freelist) > 100MB
  // - OU mais de 20 eventos gigantes (> 1MB)
  // - OU mais de 250.000 eventos e sem manutenção recente
  const needsMaintenance =
    dbSizeBytes > 3 * 1024 * 1024 * 1024 ||
    walSizeBytes > 50 * 1024 * 1024 ||
    freeBytesInDb > 100 * 1024 * 1024 ||
    largeEventCount > 20 ||
    eventCount > 250000

  return {
    dbSizeBytes,
    walSizeBytes,
    eventCount,
    largeEventCount,
    needsMaintenance,
    lastMaintenanceTime,
    lastFreedBytes,
    lastPurgedEvents,
  }
}

export async function runSystemMaintenance(options?: {
  purgeOldSessions?: boolean
  maxAgeDays?: number
  fullVacuum?: boolean
  serverRunning?: boolean
}): Promise<SystemMaintenanceResult> {
  const start = Date.now()
  const userDataPath = app.getPath("userData")
  const dbPath = process.env.ALLCODE_DB ?? join(userDataPath, "allcode.db")
  const walPath = `${dbPath}-wal`

  let beforeBytes = 0
  try {
    const dbStat = await stat(dbPath).catch(() => null)
    const walStat = await stat(walPath).catch(() => null)
    beforeBytes = (dbStat?.size ?? 0) + (walStat?.size ?? 0)
  } catch {}

  let purgedEvents = 0

  // Abre conexão para manutenção (executa checkpoint, purge de eventos antigos e otimização)
  const native = new DatabaseSync(dbPath)
  try {
    native.exec("PRAGMA busy_timeout = 30000;")

    // 1. Checkpoint PASSIVE não toma lock exclusivo e não derruba o sidecar,
    // que continua lendo/escrevendo no mesmo arquivo.
    native.exec("PRAGMA wal_checkpoint(PASSIVE);")

    // 2. Remove eventos antigos órfãos de mensagens com diffs enormes (> 1MB)
    // Esses eventos 'message.updated.1' contêm históricos duplicados com centenas de megas.
    // Feito em lotes para não segurar o write lock por minutos e derrubar o sidecar.
    try {
      purgedEvents += await purgeLargeMessageEvents(native)
    } catch {}

    // 3. Expurgo de sessões antigas (padrão: 30 dias se solicitado)
    if (options?.purgeOldSessions) {
      const days = options.maxAgeDays ?? 30
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      try {
        const oldSessions = native
          .prepare("SELECT id FROM session WHERE time_updated < ?")
          .all(cutoff) as Array<{ id: string }>

        for (const s of oldSessions) {
          try {
            // Remove eventos associados
            native.prepare("DELETE FROM event WHERE aggregate_id = ?").run(s.id)
            native.prepare("DELETE FROM event_sequence WHERE aggregate_id = ?").run(s.id)
            // Remove sessão (as tabelas filhas message, part, todo têm ON DELETE CASCADE)
            native.prepare("DELETE FROM session WHERE id = ?").run(s.id)
          } catch {}
        }
      } catch {}
    }

    // 4. Compacta eventos de streaming intermediários (.updated.) em sessões com mais de 7 dias
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      const oldEventSessions = native
        .prepare("SELECT id FROM session WHERE time_updated < ?")
        .all(sevenDaysAgo) as Array<{ id: string }>
      
      for (const s of oldEventSessions) {
        try {
          purgedEvents += await purgeStreamingEvents(native, s.id)
        } catch {}
      }
    } catch {}

    // 5. Otimiza índices e estatísticas do SQLite
    native.exec("PRAGMA optimize;")

    // 6. Checkpoint final antes do vacuum
    native.exec("PRAGMA wal_checkpoint(PASSIVE);")

    // 7. VACUUM completo (libera o espaço físico no disco)
    // VACUUM reescreve o arquivo inteiro e exige lock exclusivo por minutos
    // num banco grande. Com o sidecar rodando isso vira SQLITE_BUSY nas
    // requisições do app, então só roda com o servidor parado.
    const freelistRow = native.prepare("SELECT freelist_count, page_size FROM pragma_freelist_count(), pragma_page_size()").get() as { freelist_count: number; page_size: number } | undefined
    const freeBytesInFile = (freelistRow?.freelist_count ?? 0) * (freelistRow?.page_size ?? 4096)
    if (options?.fullVacuum || freeBytesInFile > 50 * 1024 * 1024) {
      if (options?.serverRunning) {
        try {
          getStore().set(PENDING_VACUUM_KEY, true)
        } catch {}
      } else {
        try {
          native.exec("VACUUM;")
        } catch {}
      }
    }
  } finally {
    native.close()
  }

  let afterBytes = 0
  try {
    const dbStat = await stat(dbPath).catch(() => null)
    const walStat = await stat(walPath).catch(() => null)
    afterBytes = (dbStat?.size ?? 0) + (walStat?.size ?? 0)
  } catch {}

  const freedBytes = Math.max(0, beforeBytes - afterBytes)
  const durationMs = Date.now() - start

  // Grava histórico da última manutenção
  try {
    const store = getStore()
    store.set(LAST_MAINTENANCE_TIME_KEY, Date.now())
    store.set(LAST_FREED_BYTES_KEY, freedBytes)
    store.set(LAST_PURGED_EVENTS_KEY, purgedEvents)
  } catch {}

  return {
    freedBytes,
    purgedEvents,
    durationMs,
  }
}

const DELETE_BATCH_SIZE = 100
const DELETE_BATCH_PAUSE_MS = 25

async function purgeLargeMessageEvents(native: DatabaseSync): Promise<number> {
  const select = native.prepare(
    "SELECT id FROM event WHERE id > ? AND type = 'message.updated.1' AND length(data) > 1000000 ORDER BY id LIMIT ?",
  )
  let purged = 0
  let cursor = ""
  while (true) {
    const rows = select.all(cursor, DELETE_BATCH_SIZE) as Array<{ id: string }>
    if (rows.length === 0) return purged
    cursor = rows[rows.length - 1].id
    purged += deleteEventBatch(
      native,
      rows.map((row) => row.id),
    )
    await new Promise((resolve) => setTimeout(resolve, DELETE_BATCH_PAUSE_MS))
  }
}

async function purgeStreamingEvents(native: DatabaseSync, aggregateID: string): Promise<number> {
  const select = native.prepare(
    "SELECT id, seq FROM event WHERE aggregate_id = ? AND type LIKE '%.updated.%' AND seq > ? ORDER BY seq LIMIT ?",
  )
  let purged = 0
  let cursor = -1
  while (true) {
    const rows = select.all(aggregateID, cursor, DELETE_BATCH_SIZE) as Array<{ id: string; seq: number }>
    if (rows.length === 0) return purged
    cursor = rows[rows.length - 1].seq
    purged += deleteEventBatch(
      native,
      rows.map((row) => row.id),
    )
    await new Promise((resolve) => setTimeout(resolve, DELETE_BATCH_PAUSE_MS))
  }
}

function deleteEventBatch(native: DatabaseSync, ids: string[]): number {
  const remove = native.prepare("DELETE FROM event WHERE id = ?")
  native.exec("BEGIN")
  try {
    for (const id of ids) remove.run(id)
    native.exec("COMMIT")
  } catch (error) {
    native.exec("ROLLBACK")
    throw error
  }
  return ids.length
}

export async function runPendingVacuum(): Promise<boolean> {
  let pending = false
  try {
    pending = Boolean(getStore().get(PENDING_VACUUM_KEY))
  } catch {}
  if (!pending) return false

  const dbPath = process.env.ALLCODE_DB ?? join(app.getPath("userData"), "allcode.db")
  const native = new DatabaseSync(dbPath)
  try {
    native.exec("PRAGMA busy_timeout = 30000;")
    native.exec("PRAGMA wal_checkpoint(PASSIVE);")
    native.exec("VACUUM;")
    try {
      getStore().set(PENDING_VACUUM_KEY, false)
    } catch {}
    return true
  } catch {
    return false
  } finally {
    native.close()
  }
}
