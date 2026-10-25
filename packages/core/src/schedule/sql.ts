import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"
import type { Schedule } from "../schedule"

export const ScheduleTable = sqliteTable("schedule", {
  id: text().$type<Schedule.ID>().primaryKey(),
  name: text(),
  description: text(),
  trigger: text({ mode: "json" }).$type<Schedule.Trigger>().notNull(),
  action: text({ mode: "json" }).$type<Schedule.Action>().notNull(),
  workspace: text(),
  enabled: integer({ mode: "boolean" }).notNull(),
  last_run_at: integer(),
  last_status: text().$type<"success" | "error">(),
  last_error: text(),
  last_session_id: text(),
  ...Timestamps,
})

export const DaemonHeartbeatTable = sqliteTable("daemon_heartbeat", {
  instance_id: text().primaryKey(),
  pid: integer().notNull(),
  process_title: text().notNull(),
  last_seen: integer().notNull(),
  owner_id: text(),
  lease_until: integer(),
})

export const ScheduleRunTable = sqliteTable(
  "schedule_run",
  {
    id: text().primaryKey(),
    schedule_id: text()
      .notNull()
      .references(() => ScheduleTable.id, { onDelete: "cascade" }),
    started_at: integer().notNull(),
    duration_ms: integer().notNull(),
    status: text().$type<Schedule.RunStatus>().notNull(),
    error: text(),
    session_id: text(),
    finished_at: integer(),
    trigger_source: text().$type<Schedule.RunTrigger>(),
    attempt: integer().notNull().default(1),
    scheduled_for: integer(),
    claimed_by: text(),
    lease_until: integer(),
  },
  (table) => [
    index("schedule_run_schedule_started_idx").on(table.schedule_id, table.started_at),
    index("schedule_run_status_started_idx").on(table.status, table.started_at),
  ],
)

