import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261013180000_add_credential_disabled",
  up(tx) {
    return Effect.gen(function* () {
      const columns = yield* tx.all<{ name: string }>(`PRAGMA table_info(\`credential\`)`)
      if (!columns.some((c) => c.name === "disabled")) {
        yield* tx.run(`
          ALTER TABLE \`credential\` ADD COLUMN \`disabled\` integer;
        `)
      }
    })
  },
} satisfies DatabaseMigration.Migration
