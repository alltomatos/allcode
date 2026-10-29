export * as Schedule from "./schedule"

import { Schema } from "effect"
import { define, inventory } from "./event"
import { ascending } from "./identifier"
import { optional, statics } from "./schema"

export const ID = Schema.String.pipe(
  Schema.brand("Schedule.ID"),
  statics((schema) => ({ create: () => schema.make("sch_" + ascending()) })),
)
export type ID = typeof ID.Type

export interface CronTrigger extends Schema.Schema.Type<typeof CronTrigger> {}
export const CronTrigger = Schema.Struct({
  kind: Schema.Literal("cron"),
  expr: Schema.String,
}).annotate({ identifier: "Schedule.CronTrigger" })

export interface IntervalTrigger extends Schema.Schema.Type<typeof IntervalTrigger> {}
export const IntervalTrigger = Schema.Struct({
  kind: Schema.Literal("interval"),
  ms: Schema.Number,
}).annotate({ identifier: "Schedule.IntervalTrigger" })

export interface ManualTrigger extends Schema.Schema.Type<typeof ManualTrigger> {}
export const ManualTrigger = Schema.Struct({
  kind: Schema.Literal("manual"),
}).annotate({ identifier: "Schedule.ManualTrigger" })

export interface OnceTrigger extends Schema.Schema.Type<typeof OnceTrigger> {}
export const OnceTrigger = Schema.Struct({
  kind: Schema.Literal("once"),
  timestamp: Schema.Number,
}).annotate({ identifier: "Schedule.OnceTrigger" })

export const Trigger = Schema.Union([CronTrigger, IntervalTrigger, ManualTrigger, OnceTrigger])
  .pipe(Schema.toTaggedUnion("kind"))
  .annotate({ identifier: "Schedule.Trigger" })
export type Trigger = Schema.Schema.Type<typeof Trigger>

export interface ShellAction extends Schema.Schema.Type<typeof ShellAction> {}
export const ShellAction = Schema.Struct({
  kind: Schema.Literal("shell"),
  command: Schema.String,
  timeoutMs: optional(Schema.Number),
}).annotate({ identifier: "Schedule.ShellAction" })

export interface McpToolAction extends Schema.Schema.Type<typeof McpToolAction> {}
export const McpToolAction = Schema.Struct({
  kind: Schema.Literal("mcp_tool"),
  server: Schema.String,
  tool: Schema.String,
  args: optional(Schema.Record(Schema.String, Schema.Unknown)),
  timeoutMs: optional(Schema.Number),
}).annotate({ identifier: "Schedule.McpToolAction" })

export interface SkillMcpTool extends Schema.Schema.Type<typeof SkillMcpTool> {}
export const SkillMcpTool = Schema.Struct({
  server: Schema.String,
  tool: Schema.String,
}).annotate({ identifier: "Schedule.SkillMcpTool" })

export interface SkillAction extends Schema.Schema.Type<typeof SkillAction> {}
export const SkillAction = Schema.Struct({
  kind: Schema.Literal("skill"),
  instructions: Schema.String,
  mcpTools: optional(Schema.Array(SkillMcpTool)),
  workspaces: optional(Schema.Array(Schema.String)),
  model: optional(Schema.String),
  permission: optional(Schema.Literals(["auto", "bypass", "default"])),
  timeoutMs: optional(Schema.Number),
}).annotate({ identifier: "Schedule.SkillAction" })

export interface AgentUIAction extends Schema.Schema.Type<typeof AgentUIAction> {}
export const AgentUIAction = Schema.Struct({
  kind: Schema.Literal("agentui"),
  agentId: Schema.String,
  message: Schema.String,
  timeoutMs: optional(Schema.Number),
}).annotate({ identifier: "Schedule.AgentUIAction" })

export interface ReminderAction extends Schema.Schema.Type<typeof ReminderAction> {}
export const ReminderAction = Schema.Struct({
  kind: Schema.Literal("reminder"),
  title: Schema.String,
  message: Schema.String,
  channels: optional(Schema.Array(Schema.Literals(["desktop", "agentui", "telegram", "whatsapp"]))),
  targetSessionId: optional(Schema.String),
  agentId: optional(Schema.String),
}).annotate({ identifier: "Schedule.ReminderAction" })

export const Action = Schema.Union([ShellAction, McpToolAction, SkillAction, AgentUIAction, ReminderAction])
  .pipe(Schema.toTaggedUnion("kind"))
  .annotate({ identifier: "Schedule.Action" })
export type Action = Schema.Schema.Type<typeof Action>

export interface Info extends Schema.Schema.Type<typeof Info> {}
export const Info = Schema.Struct({
  id: ID,
  name: optional(Schema.String),
  description: optional(Schema.String),
  trigger: Trigger,
  action: Action,
  workspace: optional(Schema.String),
  enabled: optional(Schema.Boolean),
  lastRunAt: optional(Schema.Number),
  lastStatus: optional(Schema.Literals(["success", "error"])),
  lastError: optional(Schema.String),
  lastSessionId: optional(Schema.String),
}).annotate({ identifier: "Schedule.Info" })

export interface CreateInput extends Schema.Schema.Type<typeof CreateInput> {}
export const CreateInput = Schema.Struct({
  name: optional(Schema.String),
  description: optional(Schema.String),
  trigger: Trigger,
  action: Action,
  workspace: optional(Schema.String),
  enabled: optional(Schema.Boolean),
}).annotate({ identifier: "Schedule.CreateInput" })

export interface UpdateInput extends Schema.Schema.Type<typeof UpdateInput> {}
export const UpdateInput = Schema.Struct({
  name: optional(Schema.String),
  description: optional(Schema.String),
  trigger: optional(Trigger),
  action: optional(Action),
  workspace: optional(Schema.String),
  enabled: optional(Schema.Boolean),
}).annotate({ identifier: "Schedule.UpdateInput" })

export interface TestInput extends Schema.Schema.Type<typeof TestInput> {}
export const TestInput = Schema.Struct({
  action: Action,
  workspace: optional(Schema.String),
}).annotate({ identifier: "Schedule.TestInput" })

export interface TestResult extends Schema.Schema.Type<typeof TestResult> {}
export const TestResult = Schema.Struct({
  success: Schema.Boolean,
  error: optional(Schema.String),
  sessionId: optional(Schema.String),
}).annotate({ identifier: "Schedule.TestResult" })

export const RunID = Schema.String.pipe(
  Schema.brand("Schedule.RunID"),
  statics((schema) => ({ create: () => schema.make("run_" + ascending()) })),
)
export type RunID = typeof RunID.Type

export const RunStatus = Schema.Literals(["running", "success", "error", "timeout", "cancelled", "skipped"])
export type RunStatus = typeof RunStatus.Type

export const RunTrigger = Schema.Literals(["cron", "interval", "once", "manual", "test", "catchup"])
export type RunTrigger = typeof RunTrigger.Type

export interface RunInfo extends Schema.Schema.Type<typeof RunInfo> {}
export const RunInfo = Schema.Struct({
  id: RunID,
  scheduleId: ID,
  startedAt: Schema.Number,
  durationMs: Schema.Number,
  status: RunStatus,
  trigger: RunTrigger,
  attempt: Schema.Number,
  error: optional(Schema.String),
  sessionId: optional(Schema.String),
  finishedAt: optional(Schema.Number),
  scheduledFor: optional(Schema.Number),
  claimedBy: optional(Schema.String),
}).annotate({ identifier: "Schedule.RunInfo" })

export interface DaemonHeartbeat extends Schema.Schema.Type<typeof DaemonHeartbeat> {}
export const DaemonHeartbeat = Schema.Struct({
  instanceId: Schema.String,
  pid: Schema.Number,
  processTitle: Schema.String,
  lastSeen: Schema.Number,
  ownerId: optional(Schema.String),
  leaseUntil: optional(Schema.Number),
}).annotate({ identifier: "Schedule.DaemonHeartbeat" })

// Mutations happen in several places (HTTP routes, the `routine` chat tool,
// future CLI paths), so the events live next to the schedule schema and are
// published by the Schedule service itself instead of by each caller.
const Created = define({ type: "schedule.created", schema: { id: ID } })
const Updated = define({ type: "schedule.updated", schema: { id: ID } })
const Deleted = define({ type: "schedule.deleted", schema: { id: ID } })
export const Event = {
  Created,
  Updated,
  Deleted,
  Definitions: inventory(Created, Updated, Deleted),
}

