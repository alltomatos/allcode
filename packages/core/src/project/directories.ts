export * as ProjectDirectories from "./directories"

import { and, asc, desc, eq, isNotNull, isNull, ne, or } from "drizzle-orm"
import { Context, Effect, Layer, Schema } from "effect"
import { Database } from "../database/database"
import { makeGlobalNode } from "../effect/app-node"
import { AbsolutePath, optional } from "../schema"
import { ProjectSchema } from "./schema"
import { ProjectDirectoryTable, ProjectTable } from "./sql"
import type { EffectDrizzleSqlite } from "@allcode/effect-drizzle-sqlite"

export interface Directory {
  readonly directory: AbsolutePath
  readonly strategy?: string
}

export const CreateInput = Schema.Struct({
  projectID: ProjectSchema.ID,
  directory: AbsolutePath,
  strategy: Schema.optional(Schema.String),
  behavior: Schema.Literals(["ignore", "replace"]).pipe(Schema.optional),
})
export type CreateInput = typeof CreateInput.Type

export const RemoveInput = Schema.Struct({
  projectID: ProjectSchema.ID,
  directory: AbsolutePath,
})
export type RemoveInput = typeof RemoveInput.Type

type DatabaseClient = EffectDrizzleSqlite.EffectSQLiteDatabase
export type Transaction = Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0]

export const ListInput = Schema.Struct({
  projectID: ProjectSchema.ID,
}).annotate({ identifier: "Project.DirectoriesInput" })
export type ListInput = typeof ListInput.Type

export const ListOutput = Schema.Array(
  Schema.Struct({
    directory: AbsolutePath,
    strategy: optional(Schema.String),
  }),
).annotate({ identifier: "Project.Directories" })
export type ListOutput = typeof ListOutput.Type

export interface Interface {
  readonly list: (projectID: ProjectSchema.ID) => Effect.Effect<ReadonlyArray<Directory>>
  readonly get: (input: {
    projectID: ProjectSchema.ID
    directory: AbsolutePath
  }) => Effect.Effect<Directory | undefined>
  readonly contains: (input: { projectID: ProjectSchema.ID; directory: AbsolutePath }) => Effect.Effect<boolean>
  readonly create: (input: CreateInput, tx?: Transaction) => Effect.Effect<boolean>
  readonly remove: (input: RemoveInput, tx?: Transaction) => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ProjectDirectories") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = (yield* Database.Service).db
    const globalDbOption = yield* Effect.serviceOption(Database.GlobalService)

    type TargetDatabase = DatabaseClient | Transaction

    const ensureProjectInTarget = (targetDb: TargetDatabase, projectID: ProjectSchema.ID) =>
      Effect.gen(function* () {
        if (globalDbOption._tag === "None") return
        const globalDb = globalDbOption.value.db
        if (targetDb === globalDb) return
        const project = yield* globalDb
          .select()
          .from(ProjectTable)
          .where(eq(ProjectTable.id, projectID))
          .get()
          .pipe(Effect.orDie)
        if (project) {
          yield* targetDb.insert(ProjectTable).values(project).onConflictDoNothing().run().pipe(Effect.orDie)
        }
      })

    const create = Effect.fn("ProjectDirectories.create")(function* (input: CreateInput, tx?: Transaction) {
      const targetDb: TargetDatabase = tx ?? db
      yield* ensureProjectInTarget(targetDb, input.projectID)
      const insert = (target: TargetDatabase) => {
        const ins = target
          .insert(ProjectDirectoryTable)
          .values({ project_id: input.projectID, directory: input.directory, strategy: input.strategy })
        return input.behavior === "replace"
          ? ins.onConflictDoUpdate({
              target: [ProjectDirectoryTable.project_id, ProjectDirectoryTable.directory],
              set: { strategy: input.strategy ?? null },
              setWhere: input.strategy
                ? or(isNull(ProjectDirectoryTable.strategy), ne(ProjectDirectoryTable.strategy, input.strategy))
                : isNotNull(ProjectDirectoryTable.strategy),
            })
          : ins.onConflictDoNothing()
      }

      if (globalDbOption._tag === "Some" && targetDb !== globalDbOption.value.db) {
        yield* insert(globalDbOption.value.db).run().pipe(Effect.orDie)
      }

      return (
        (yield* insert(targetDb).returning({ directory: ProjectDirectoryTable.directory }).get().pipe(Effect.orDie)) !== undefined
      )
    })

    const remove = Effect.fn("ProjectDirectories.remove")(function* (input: RemoveInput, tx?: Transaction) {
      const targetDb: TargetDatabase = tx ?? db
      const del = (target: TargetDatabase) =>
        target
          .delete(ProjectDirectoryTable)
          .where(
            and(
              eq(ProjectDirectoryTable.project_id, input.projectID),
              eq(ProjectDirectoryTable.directory, input.directory),
            ),
          )

      if (globalDbOption._tag === "Some" && targetDb !== globalDbOption.value.db) {
        yield* del(globalDbOption.value.db).run().pipe(Effect.orDie)
      }

      return (
        (yield* del(targetDb)
          .returning({ directory: ProjectDirectoryTable.directory })
          .get()
          .pipe(Effect.orDie)) !== undefined
      )
    })

    const queryTarget = (targetDb: TargetDatabase, projectID: ProjectSchema.ID) =>
      targetDb
        .select({ directory: ProjectDirectoryTable.directory, strategy: ProjectDirectoryTable.strategy })
        .from(ProjectDirectoryTable)
        .where(eq(ProjectDirectoryTable.project_id, projectID))
        .orderBy(desc(ProjectDirectoryTable.time_created), asc(ProjectDirectoryTable.directory))
        .all()
        .pipe(Effect.orDie)

    const list = Effect.fn("ProjectDirectories.list")(function* (projectID: ProjectSchema.ID) {
      const rows = yield* queryTarget(db, projectID)
      if (rows.length > 0 || globalDbOption._tag === "None" || db === globalDbOption.value.db) {
        return rows.map((row) => ({ directory: row.directory, strategy: row.strategy ?? undefined }))
      }
      const globalRows = yield* queryTarget(globalDbOption.value.db, projectID)
      return globalRows.map((row) => ({ directory: row.directory, strategy: row.strategy ?? undefined }))
    })

    const contains = Effect.fn("ProjectDirectories.contains")(function* (input: {
      projectID: ProjectSchema.ID
      directory: AbsolutePath
    }) {
      return (
        (yield* db
          .select({ directory: ProjectDirectoryTable.directory })
          .from(ProjectDirectoryTable)
          .where(
            and(
              eq(ProjectDirectoryTable.project_id, input.projectID),
              eq(ProjectDirectoryTable.directory, input.directory),
            ),
          )
          .get()
          .pipe(Effect.orDie)) !== undefined
      )
    })

    const get = Effect.fn("ProjectDirectories.get")(function* (input: {
      projectID: ProjectSchema.ID
      directory: AbsolutePath
    }) {
      const row = yield* db
        .select({ directory: ProjectDirectoryTable.directory, strategy: ProjectDirectoryTable.strategy })
        .from(ProjectDirectoryTable)
        .where(
          and(
            eq(ProjectDirectoryTable.project_id, input.projectID),
            eq(ProjectDirectoryTable.directory, input.directory),
          ),
        )
        .get()
        .pipe(Effect.orDie)
      return row ? { directory: row.directory, strategy: row.strategy ?? undefined } : undefined
    })

    return Service.of({
      list,
      get,
      contains,
      create,
      remove,
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer: layer, deps: [Database.node, Database.globalNode] })
