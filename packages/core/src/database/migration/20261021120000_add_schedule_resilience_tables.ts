import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261021120000_add_schedule_resilience_tables",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS \`daemon_heartbeat\` (
          \`instance_id\` text PRIMARY KEY,
          \`pid\` integer NOT NULL,
          \`process_title\` text NOT NULL,
          \`last_seen\` integer NOT NULL
        );
      `)
      yield* tx.run(`
        CREATE TABLE IF NOT EXISTS \`schedule_run\` (
          \`id\` text PRIMARY KEY,
          \`schedule_id\` text NOT NULL,
          \`started_at\` integer NOT NULL,
          \`duration_ms\` integer NOT NULL,
          \`status\` text NOT NULL,
          \`error\` text,
          \`session_id\` text,
          CONSTRAINT \`fk_schedule_run_schedule_id\` FOREIGN KEY (\`schedule_id\`) REFERENCES \`schedule\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`
        CREATE INDEX IF NOT EXISTS \`schedule_run_schedule_started_idx\` ON \`schedule_run\` (\`schedule_id\`, \`started_at\`);
      `)
    })
  },
} satisfies DatabaseMigration.Migration
