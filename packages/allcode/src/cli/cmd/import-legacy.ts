import { Database } from "@opencode-ai/core/database/database"
import { SessionTable, MessageTable, PartTable } from "@opencode-ai/core/session/sql"
import { Effect } from "effect"
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"
import { xdgData, xdgConfig } from "xdg-basedir"
import { Branding } from "@opencode-ai/core/branding"
import type { InstanceContext } from "@/project/instance-context"

export interface MigrationSummary {
  readonly sessionsImported: number
  readonly messagesImported: number
  readonly partsImported: number
  readonly projectConfigImported: boolean
}

export function getLegacyOpenCodePaths() {
  const homeData = xdgData ? path.join(xdgData, Branding.legacyAppName) : null
  const homeConfig = xdgConfig ? path.join(xdgConfig, Branding.legacyAppName) : null
  const dbPath = homeData ? path.join(homeData, `${Branding.legacyAppName}.db`) : null

  return {
    homeData,
    homeConfig,
    dbPath,
  }
}

export const importFromLegacyOpenCode = Effect.fn("LegacyMigrator.import")(function* (ctx: InstanceContext) {
  const { db } = yield* Database.Service
  const legacy = getLegacyOpenCodePaths()

  let sessionsCount = 0
  let messagesCount = 0
  let partsCount = 0
  let configImported = false

  // 1. Verificar e copiar configuração local do projeto (.opencode/opencode.json -> .allcode/allcode.json)
  const legacyProjectDir = path.join(ctx.worktree, Branding.legacyConfigDir)
  const newProjectDir = path.join(ctx.worktree, Branding.configDir)

  if (existsSync(legacyProjectDir)) {
    yield* Effect.promise(async () => {
      await fs.mkdir(newProjectDir, { recursive: true })
      for (const ext of ["json", "jsonc"]) {
        const legacyFile = path.join(legacyProjectDir, `${Branding.legacyConfigFileBase}.${ext}`)
        const targetFile = path.join(newProjectDir, `${Branding.configFileBase}.${ext}`)
        if (existsSync(legacyFile) && !existsSync(targetFile)) {
          await fs.copyFile(legacyFile, targetFile)
          configImported = true
        }
      }
    })
  }

  // 2. Se houver banco do OpenCode instalado, importar sessões do projeto atual
  if (legacy.dbPath && existsSync(legacy.dbPath)) {
    const rawDb = yield* Effect.promise(async () => {
      const { Database: BunSqlite } = await import("bun:sqlite")
      return new BunSqlite(legacy.dbPath!, { readonly: true })
    })

    try {
      // Importar sessões correspondentes a este projeto ou diretório
      const sessions = rawDb
        .query(
          "SELECT * FROM session WHERE project_id = ? OR directory = ? ORDER BY time_created ASC",
        )
        .all(ctx.project.id, ctx.directory) as Array<{
        id: string
        project_id: string
        directory: string
        parent_id?: string | null
        title: string
        time_created: number
        time_updated: number
        summary?: string | null
        path?: string | null
        slug?: string | null
        version?: string | null
      }>

      for (const s of sessions) {
        yield* db
          .insert(SessionTable)
          .values({
            id: s.id as any,
            project_id: ctx.project.id,
            directory: ctx.directory,
            parent_id: (s.parent_id ?? undefined) as any,
            title: s.title,
            slug: s.slug ?? s.id,
            version: s.version ?? "1",
            time_created: s.time_created,
            time_updated: s.time_updated,
            path: s.path,
          })
          .onConflictDoNothing()
          .run()
          .pipe(Effect.orDie)

        sessionsCount++

        // Mensagens da sessão
        const messages = rawDb
          .query("SELECT * FROM message WHERE session_id = ?")
          .all(s.id) as Array<{
          id: string
          session_id: string
          time_created: number
          data: string
        }>

        for (const m of messages) {
          const parsedData = typeof m.data === "string" ? JSON.parse(m.data) : m.data
          yield* db
            .insert(MessageTable)
            .values({
              id: m.id as any,
              session_id: s.id as any,
              time_created: m.time_created,
              data: parsedData as any,
            })
            .onConflictDoNothing()
            .run()
            .pipe(Effect.orDie)

          messagesCount++
        }

        // Partes da sessão
        const parts = rawDb
          .query("SELECT * FROM part WHERE session_id = ?")
          .all(s.id) as Array<{
          id: string
          message_id: string
          session_id: string
          data: string
        }>

        for (const p of parts) {
          const parsedPartData = typeof p.data === "string" ? JSON.parse(p.data) : p.data
          yield* db
            .insert(PartTable)
            .values({
              id: p.id as any,
              message_id: p.message_id as any,
              session_id: s.id as any,
              data: parsedPartData as any,
            })
            .onConflictDoNothing()
            .run()
            .pipe(Effect.orDie)

          partsCount++
        }
      }
    } finally {
      rawDb.close()
    }
  }

  const result: MigrationSummary = {
    sessionsImported: sessionsCount,
    messagesImported: messagesCount,
    partsImported: partsCount,
    projectConfigImported: configImported,
  }

  return result
})
