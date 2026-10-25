export * as ScheduleSkillCaller from "./skill-caller"

import { Effect, Layer } from "effect"
import { makeGlobalNode } from "@allcode/core/effect/app-node"
import { ScheduleRunner } from "@allcode/core/schedule/runner"
import { PermissionV1 } from "@allcode/core/v1/permission"
import { InstanceRef } from "@/effect/instance-ref"
import { InstanceStore } from "@/project/instance-store"
import { Session } from "@/session/session"
import { SessionPrompt } from "@/session/prompt"
import { McpCatalog } from "@/mcp/catalog"
import { ProviderV2 } from "@allcode/core/provider"
import { ModelV2 } from "@allcode/core/model"
import { SessionID } from "@/session/schema"

import { Combo } from "@/combo"

const AUTONOMOUS_INSTRUCTION =
  "Você está executando uma rotina automática, sem usuário presente. Nunca faça perguntas nem aguarde input humano. Se faltar informação, credencial ou permissão, registre o bloqueio no relatório final e encerre a execução."

function buildPermissions(
  mcpTools: readonly { server: string; tool: string }[] | undefined,
  permissionMode?: "auto" | "bypass" | "default",
): PermissionV1.Ruleset {
  const rules: PermissionV1.Rule[] = []

  if (permissionMode === "bypass" || permissionMode === "auto") {
    rules.push({ permission: "*", pattern: "*", action: "allow" })
  } else if (mcpTools && mcpTools.length > 0) {
    // Standard built-in tools allowed for general inspection/reasoning
    rules.push(
      { permission: "read", pattern: "*", action: "allow" },
      { permission: "glob", pattern: "*", action: "allow" },
      { permission: "grep", pattern: "*", action: "allow" },
      { permission: "webfetch", pattern: "*", action: "allow" },
      { permission: "todowrite", pattern: "*", action: "allow" },
    )
    for (const tool of mcpTools) {
      rules.push({
        permission: `${McpCatalog.sanitize(tool.server)}_${tool.tool}`,
        pattern: "*",
        action: "allow",
      })
      // Also allow whole server wildcard if needed
      rules.push({
        permission: `${McpCatalog.sanitize(tool.server)}_*`,
        pattern: "*",
        action: "allow",
      })
    }
  } else {
    // Default: allow safe tools + all MCP tools
    rules.push({ permission: "*", pattern: "*", action: "allow" })
  }

  // Rotinas não têm usuário presente: a tool `question` bloquearia o loop até
  // o timeout. Regra negada por último vence (findLast), inclusive sobre `*`.
  rules.push({ permission: "question", pattern: "*", action: "deny" })
  return rules
}

/** Wires the Schedule engine's skill action to OpenCode's real Session execution loop. */
export const layer = Layer.effect(
  ScheduleRunner.SkillCaller,
  Effect.gen(function* () {
    const instanceStore = yield* InstanceStore.Service
    const sessions = yield* Session.Service
    const promptSvc = yield* SessionPrompt.Service
    const combos = yield* Combo.Service

    return ScheduleRunner.SkillCaller.of({
      runSkill: (action, workspace, existingSessionId) =>
        Effect.gen(function* () {
          const directory = workspace || process.cwd()
          const ctx = yield* instanceStore.load({ directory })

          return yield* Effect.gen(function* () {
            let modelParam: { providerID: ProviderV2.ID; modelID: ModelV2.ID } | undefined = undefined
            if (action.model) {
              const spec = action.model
              if (spec.startsWith("combo:")) {
                const comboId = spec.slice("combo:".length)
                modelParam = {
                  providerID: ProviderV2.ID.make("combo"),
                  modelID: ModelV2.ID.make(comboId),
                }
              } else {
                const comboFound = yield* combos.get(spec).pipe(Effect.orElseSucceed(() => undefined))
                if (comboFound) {
                  modelParam = {
                    providerID: ProviderV2.ID.make("combo"),
                    modelID: ModelV2.ID.make(spec),
                  }
                } else {
                  const separator = spec.indexOf("/")
                  if (separator > 0) {
                    const providerID = spec.slice(0, separator)
                    const modelID = spec.slice(separator + 1)
                    if (providerID && modelID) {
                      modelParam = {
                        providerID: ProviderV2.ID.make(providerID),
                        modelID: ModelV2.ID.make(modelID),
                      }
                    }
                  }
                }
              }
            }

            const permissionRules = buildPermissions(action.mcpTools, action.permission)

            let effectivePrompt = `${AUTONOMOUS_INSTRUCTION}\n\n${action.instructions}`
            if (action.workspaces && action.workspaces.length > 0) {
              effectivePrompt += `\n\nPastas / Repositórios de trabalho adicionais configurados:\n` +
                action.workspaces.map((w, idx) => `- Pasta ${idx + 1}: ${w}`).join("\n")
            }

            // Check if existing session ID is provided and still valid
            let sessionIdToUse: SessionID | undefined = undefined
            if (existingSessionId) {
              const parsedId = SessionID.make(existingSessionId)
              const existingSession = yield* sessions
                .get(parsedId)
                .pipe(Effect.orElseSucceed(() => undefined))
              if (existingSession && !existingSession.time.archived) {
                sessionIdToUse = existingSession.id
                yield* Effect.logInfo("ScheduleSkillCaller reusing existing routine session", {
                  sessionId: sessionIdToUse,
                  directory,
                })
              }
            }

            if (!sessionIdToUse) {
              yield* Effect.logInfo("ScheduleSkillCaller creating new routine session", {
                directory,
                model: modelParam,
                instructionPreview: action.instructions.slice(0, 80),
              })

              const session = yield* sessions
                .create({
                  title: `Rotina: ${action.instructions.slice(0, 40)}`,
                  directory,
                  permission: permissionRules,
                  model: modelParam ? { id: modelParam.modelID, providerID: modelParam.providerID } : undefined,
                })
                .pipe(
                  Effect.tapError((err) => Effect.logError("ScheduleSkillCaller session creation failed", { err })),
                )

              sessionIdToUse = session.id
              yield* Effect.logInfo("ScheduleSkillCaller session created", { sessionId: sessionIdToUse })
            }

            const result = yield* promptSvc
              .prompt({
                sessionID: sessionIdToUse,
                model: modelParam,
                parts: [{ type: "text", text: effectivePrompt }],
              })
              .pipe(
                Effect.tapError((cause) =>
                  Effect.logError("ScheduleSkillCaller prompt execution failed", { sessionId: sessionIdToUse, cause }),
                ),
                Effect.catch((cause) => {
                  const msg = cause instanceof Error ? cause.message : String(cause)
                  return Effect.succeed({ error: msg } as any)
                }),
              )

            if (result && "error" in result && result.error) {
              return { success: false, error: String(result.error), sessionId: sessionIdToUse }
            }

            return { success: true, sessionId: sessionIdToUse }
          }).pipe(
            Effect.provideService(InstanceRef, ctx),
          )
        }),
    })
  }),
)

export const node = makeGlobalNode({
  service: ScheduleRunner.SkillCaller,
  layer,
  deps: [InstanceStore.node, Session.node, SessionPrompt.node, Combo.node],
})

