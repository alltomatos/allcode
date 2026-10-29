import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261028111718_schedule_tool_metadata",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`schedule_run\` ADD \`heartbeat_at\` integer;`)
      yield* tx.run(`ALTER TABLE \`schedule\` ADD \`idempotency_key\` text;`)
      yield* tx.run(`ALTER TABLE \`schedule\` ADD \`metadata\` text;`)
      yield* tx.run(`PRAGMA foreign_keys=OFF;`)
      yield* tx.run(`
        CREATE TABLE \`__new_schedule\` (
          \`id\` text PRIMARY KEY,
          \`name\` text,
          \`description\` text,
          \`trigger\` text NOT NULL,
          \`action\` text NOT NULL,
          \`workspace\` text,
          \`enabled\` integer NOT NULL,
          \`last_run_at\` integer,
          \`last_status\` text,
          \`last_error\` text,
          \`last_session_id\` text,
          \`idempotency_key\` text UNIQUE,
          \`metadata\` text,
          \`time_created\` integer NOT NULL,
          \`time_updated\` integer NOT NULL
        );
      `)
      yield* tx.run(
        `INSERT INTO \`__new_schedule\`(\`id\`, \`name\`, \`description\`, \`trigger\`, \`action\`, \`workspace\`, \`enabled\`, \`last_run_at\`, \`last_status\`, \`last_error\`, \`last_session_id\`, \`time_created\`, \`time_updated\`) SELECT \`id\`, \`name\`, \`description\`, \`trigger\`, \`action\`, \`workspace\`, \`enabled\`, \`last_run_at\`, \`last_status\`, \`last_error\`, \`last_session_id\`, \`time_created\`, \`time_updated\` FROM \`schedule\`;`,
      )
      yield* tx.run(`DROP TABLE \`schedule\`;`)
      yield* tx.run(`ALTER TABLE \`__new_schedule\` RENAME TO \`schedule\`;`)
      yield* tx.run(`PRAGMA foreign_keys=ON;`)
    })
  },
} satisfies DatabaseMigration.Migration
