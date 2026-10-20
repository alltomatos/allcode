import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261020165858_unique_king_bedlam",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS \`session_location\` (
          \`session_id\` text PRIMARY KEY,
          \`directory\` text NOT NULL,
          \`workspace_id\` text,
          \`workspace_hash\` text NOT NULL,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      const credential = yield* tx.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('credential')`)
      if (!credential.some((column) => column.name === "disabled")) {
        yield* tx.run(`ALTER TABLE \`credential\` ADD \`disabled\` integer;`)
      }
      const schedule = yield* tx.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('schedule')`)
      const names = new Set(schedule.map((column) => column.name))
      if (!names.has("name")) yield* tx.run(`ALTER TABLE \`schedule\` ADD \`name\` text;`)
      if (!names.has("description")) yield* tx.run(`ALTER TABLE \`schedule\` ADD \`description\` text;`)
      if (!names.has("last_session_id")) yield* tx.run(`ALTER TABLE \`schedule\` ADD \`last_session_id\` text;`)
      yield* tx.run(
        `CREATE INDEX IF NOT EXISTS \`session_location_directory_idx\` ON \`session_location\` (\`directory\`);`,
      )
      yield* tx.run(
        `CREATE INDEX IF NOT EXISTS \`session_location_workspace_id_idx\` ON \`session_location\` (\`workspace_id\`);`,
      )
      yield* tx.run(
        `CREATE INDEX IF NOT EXISTS \`session_location_workspace_hash_idx\` ON \`session_location\` (\`workspace_hash\`);`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
