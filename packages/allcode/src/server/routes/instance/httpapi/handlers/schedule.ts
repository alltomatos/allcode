import { Effect } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "@allcode/server/api"
import { Schedule } from "@allcode/core/schedule"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { ScheduleValidationError } from "@allcode/protocol/groups/schedule"

export const scheduleHandlers = HttpApiBuilder.group(Api, "server.schedule", (handlers) =>
  Effect.gen(function* () {
    const schedules = yield* Schedule.Service
    const skillCaller = yield* ScheduleRunner.SkillCaller
    const mcpCaller = yield* ScheduleRunner.McpCaller
    const agentUICaller = yield* ScheduleRunner.AgentUICaller
    const reminderCaller = yield* ScheduleRunner.ReminderCaller

    return handlers
      .handle(
        "schedule.list",
        Effect.fn("ScheduleHttpApi.list")(function* () {
          return yield* schedules.list()
        }),
      )
      .handle(
        "schedule.create",
        Effect.fn("ScheduleHttpApi.create")(function* (ctx) {
          return yield* schedules
            .create({
              name: ctx.payload.name,
              description: ctx.payload.description,
              trigger: ctx.payload.trigger,
              action: ctx.payload.action,
              workspace: ctx.payload.workspace,
              enabled: ctx.payload.enabled,
            })
            .pipe(
              Effect.catch((error) =>
                new ScheduleValidationError({ name: "ScheduleValidationError", message: error.message }),
              ),
            )
        }),
      )
      .handle(
        "schedule.run",
        Effect.fn("ScheduleHttpApi.run")(function* (ctx) {
          return yield* ScheduleRunner.runOne(ctx.params.scheduleID).pipe(
            Effect.provideService(ScheduleRunner.SkillCaller, skillCaller),
            Effect.provideService(ScheduleRunner.McpCaller, mcpCaller),
            Effect.provideService(ScheduleRunner.AgentUICaller, agentUICaller),
            Effect.provideService(ScheduleRunner.ReminderCaller, reminderCaller),
            Effect.catchCause((cause) =>
              new ScheduleValidationError({
                name: "ScheduleValidationError",
                message: `Falha ao rodar rotina: ${cause.toString()}`,
              }),
            ),
          )
        }),
      )
      .handle(
        "schedule.test",
        Effect.fn("ScheduleHttpApi.test")(function* (ctx) {
          return yield* ScheduleRunner.testAction(ctx.payload.action, ctx.payload.workspace).pipe(
            Effect.provideService(ScheduleRunner.SkillCaller, skillCaller),
            Effect.provideService(ScheduleRunner.McpCaller, mcpCaller),
            Effect.provideService(ScheduleRunner.AgentUICaller, agentUICaller),
            Effect.provideService(ScheduleRunner.ReminderCaller, reminderCaller),
            Effect.catchCause((cause) =>
              new ScheduleValidationError({
                name: "ScheduleValidationError",
                message: `Falha na execução: ${cause.toString()}`,
              }),
            ),
          )
        }),
      )
      .handle(
        "schedule.update",
        Effect.fn("ScheduleHttpApi.update")(function* (ctx) {
          const updated = yield* schedules
            .update(ctx.params.scheduleID, {
              name: ctx.payload.name,
              description: ctx.payload.description,
              trigger: ctx.payload.trigger,
              action: ctx.payload.action,
              workspace: ctx.payload.workspace,
              enabled: ctx.payload.enabled,
            })
            .pipe(
              Effect.catch((error: any) =>
                new ScheduleValidationError({ name: "ScheduleValidationError", message: error?.message ?? String(error) }),
              ),
            )
          if (!updated) {
            return yield* Effect.fail(
              new ScheduleValidationError({ name: "ScheduleValidationError", message: "Rotina não encontrada" }),
            )
          }
          return updated
        }),
      )
      .handle(
        "schedule.remove",
        Effect.fn("ScheduleHttpApi.remove")(function* (ctx) {
          yield* schedules.remove(ctx.params.scheduleID)
          return HttpApiSchema.NoContent.make()
        }),
      )
  }),
)

