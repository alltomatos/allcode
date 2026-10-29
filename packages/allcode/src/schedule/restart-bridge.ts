export * as ScheduleRestartBridge from "./restart-bridge"

import { Effect, Layer } from "effect"
import { makeGlobalNode } from "@allcode/core/effect/app-node"
import { Schedule } from "@allcode/core/schedule"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { ScheduleAgentUICaller } from "@/schedule/agentui-caller"
import { ScheduleMcpCaller } from "@/schedule/mcp-caller"
import { ScheduleReminderCaller } from "@/schedule/reminder-caller"
import { ScheduleSkillCaller } from "@/schedule/skill-caller"

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const schedules = yield* Schedule.Service
    const mcpCaller = yield* ScheduleRunner.McpCaller
    const skillCaller = yield* ScheduleRunner.SkillCaller
    const agentUICaller = yield* ScheduleRunner.AgentUICaller
    const reminderCaller = yield* ScheduleRunner.ReminderCaller

    const dispose = yield* ScheduleRunner.registerRestartBridge((id) =>
      ScheduleRunner.restartOne(id).pipe(
        Effect.provideService(Schedule.Service, schedules),
        Effect.provideService(ScheduleRunner.McpCaller, mcpCaller),
        Effect.provideService(ScheduleRunner.SkillCaller, skillCaller),
        Effect.provideService(ScheduleRunner.AgentUICaller, agentUICaller),
        Effect.provideService(ScheduleRunner.ReminderCaller, reminderCaller),
      ),
    )

    yield* Effect.addFinalizer(() => Effect.sync(dispose))
  }),
)

export const node = makeGlobalNode({
  name: "schedule-restart-bridge",
  layer,
  deps: [
    Schedule.node,
    ScheduleMcpCaller.node,
    ScheduleSkillCaller.node,
    ScheduleAgentUICaller.node,
    ScheduleReminderCaller.node,
  ],
})
