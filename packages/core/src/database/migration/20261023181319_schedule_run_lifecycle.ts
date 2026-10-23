import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261023181319_schedule_run_lifecycle",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`DELETE FROM \`daemon_heartbeat\` WHERE \`instance_id\` <> 'scheduler';`)
      yield* tx.run(`ALTER TABLE \`daemon_heartbeat\` ADD \`owner_id\` text;`)
      yield* tx.run(`ALTER TABLE \`daemon_heartbeat\` ADD \`lease_until\` integer;`)
      yield* tx.run(`ALTER TABLE \`schedule_run\` ADD \`finished_at\` integer;`)
      yield* tx.run(`ALTER TABLE \`schedule_run\` ADD \`trigger_source\` text;`)
      yield* tx.run(`ALTER TABLE \`schedule_run\` ADD \`attempt\` integer DEFAULT 1 NOT NULL;`)
      yield* tx.run(`ALTER TABLE \`schedule_run\` ADD \`scheduled_for\` integer;`)
      yield* tx.run(`ALTER TABLE \`schedule_run\` ADD \`claimed_by\` text;`)
      yield* tx.run(`ALTER TABLE \`schedule_run\` ADD \`lease_until\` integer;`)
      yield* tx.run(`CREATE INDEX \`schedule_run_status_started_idx\` ON \`schedule_run\` (\`status\`,\`started_at\`);`)
    })
  },
} satisfies DatabaseMigration.Migration
