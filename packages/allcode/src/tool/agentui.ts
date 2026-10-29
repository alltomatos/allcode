import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import DESCRIPTION from "./agentui.txt"
import { AgentUIStore } from "@/agentui/store"
import type { ConfigAgentUIV1 } from "@allcode/core/v1/config/agentui"
import { Storage } from "@/storage/storage"

export const Parameters = Schema.Struct({
  action: Schema.Literals(["list", "get", "create"]).annotate({
    description: "Operation: list, get or create an AgentUI agent.",
  }),
  agentId: Schema.optional(Schema.String).annotate({
    description: "AgentUI agent ID. Required for get.",
  }),
  name: Schema.optional(Schema.String).annotate({
    description: "Display name. Required for create.",
  }),
  description: Schema.optional(Schema.String).annotate({
    description: "Short description shown in the AgentUI directory.",
  }),
  systemPrompt: Schema.optional(Schema.String).annotate({
    description: "System prompt / personality that defines the agent's role and tone. Required for create.",
  }),
  model: Schema.optional(Schema.String).annotate({
    description: "Model as 'providerID/modelID' or 'combo:<id>'. Required for create.",
  }),
  tools: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "MCP server names this agent may call tools from. Empty means no MCP tools.",
  }),
  permissions: Schema.optional(
    Schema.Struct({
      filesystem: Schema.optional(Schema.Boolean),
      terminal: Schema.optional(Schema.Boolean),
      memory: Schema.optional(Schema.Boolean),
      routines: Schema.optional(Schema.Boolean),
      agenda: Schema.optional(Schema.Boolean),
      whatsapp: Schema.optional(Schema.Boolean),
    }),
  ).annotate({
    description: "Capability flags for this agent. Missing flags default to false.",
  }),
  commandTriggers: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Prefixes that address this agent on shared channels, e.g. ['#', '!'].",
  }),
  guardrails: Schema.optional(
    Schema.Struct({
      enabled: Schema.Boolean,
      level: Schema.Literals(["basic", "strict"]),
    }),
  ).annotate({ description: "Prompt-injection guardrails. Defaults to disabled/basic." }),
  enabled: Schema.optional(Schema.Boolean).annotate({
    description: "Whether the agent is enabled. Defaults to true.",
  }),
  visibility: Schema.optional(Schema.Literals(["private", "public"])).annotate({
    description: "Directory visibility. Defaults to private.",
  }),
})
export type Parameters = typeof Parameters.Type

type ErrorCode =
  | "INVALID_INPUT"
  | "AGENT_NOT_FOUND"
  | "AGENT_DUPLICATE"
  | "PERMISSION_DENIED"
  | "INTERNAL_ERROR"

type Envelope<T> = { readonly ok: true; readonly data: T } | {
  readonly ok: false
  readonly error: { readonly code: ErrorCode; readonly message: string; readonly details?: Record<string, unknown> }
}

const ok = <T>(data: T): Envelope<T> => ({ ok: true, data })
const fail = (code: ErrorCode, message: string, details?: Record<string, unknown>): Envelope<never> => ({
  ok: false,
  error: { code, message, details },
})

function result<T>(title: string, value: Envelope<T>, metadata: Record<string, unknown> = {}) {
  return {
    title,
    output: JSON.stringify(value, null, 2),
    metadata: {
      ok: value.ok,
      ...(value.ok ? {} : { code: value.error.code }),
      ...metadata,
    },
  }
}

const auditKey = (agentId: string) => ["agentui", "tool-audit", agentId]

const appendAudit = (
  storage: Storage.Interface,
  entry: {
    readonly id: string
    readonly timestamp: number
    readonly action: "create" | "status"
    readonly actor: string
    readonly sessionID?: string
    readonly agentId?: string
    readonly result: string
  },
) =>
  Effect.gen(function* () {
    const existing = yield* storage
      .read<Array<typeof entry>>(auditKey(entry.agentId ?? "global"))
      .pipe(Effect.catch(() => Effect.succeed([] as Array<typeof entry>)))
    yield* storage.write(auditKey(entry.agentId ?? "global"), [entry, ...existing].slice(0, 50))
  })

const permit = (
  ctx: Tool.Context,
  patterns: string[],
  always: string[],
  metadata: Record<string, unknown>,
) =>
  ctx
    .ask({ permission: "agentui", patterns, always, metadata })
    .pipe(Effect.as(true), Effect.catch(() => Effect.succeed(false)))

export function validModel(model: string) {
  if (model.startsWith("combo:")) return model.length > "combo:".length
  const [provider, ...rest] = model.split("/")
  return Boolean(provider && rest.join("/")) && !/\s/.test(model)
}

export function buildAgentInput(
  params: Parameters,
  id: string = crypto.randomUUID(),
): Envelope<ConfigAgentUIV1.Agent> {
  const name = params.name?.trim()
  if (!name) return fail("INVALID_INPUT", "O campo 'name' é obrigatório.", { field: "name" })
  const systemPrompt = params.systemPrompt?.trim()
  if (!systemPrompt) {
    return fail("INVALID_INPUT", "O campo 'systemPrompt' é obrigatório.", { field: "systemPrompt" })
  }
  const model = params.model?.trim()
  if (!model) return fail("INVALID_INPUT", "O campo 'model' é obrigatório.", { field: "model" })
  if (!validModel(model)) {
    return fail("INVALID_INPUT", "Use 'providerID/modelID' ou 'combo:<id>'.", {
      field: "model",
      value: model,
    })
  }

  return ok({
    id,
    name,
    description: params.description?.trim() || undefined,
    personality: systemPrompt,
    model,
    channels: [],
    commandTriggers: [...(params.commandTriggers ?? [])],
    ragSources: [],
    guardrails: params.guardrails ?? { enabled: false, level: "basic" },
    mcpServers: params.tools?.filter(Boolean) ?? [],
    routinesEnabled: params.permissions?.routines ?? false,
    agendaEnabled: params.permissions?.agenda ?? false,
    whatsappEnabled: params.permissions?.whatsapp ?? false,
    memoryEnabled: params.permissions?.memory ?? false,
    filesystemEnabled: params.permissions?.filesystem ?? false,
    terminalEnabled: params.permissions?.terminal ?? false,
    enabled: params.enabled ?? true,
    visibility: params.visibility ?? "private",
  })
}

export const AgentUITool = Tool.define(
  "agentui",
  Effect.gen(function* () {
    const agents = yield* AgentUIStore.Service
    const storage = yield* Storage.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Parameters, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const allowed = yield* permit(
            ctx,
            [params.agentId ?? "*"],
            params.action === "create" ? [] : ["*"],
            { action: params.action },
          )
          if (!allowed) {
            return result("Permissão negada", fail("PERMISSION_DENIED", "A criação de agentes não foi autorizada."))
          }

          if (params.action === "list") {
            const list = yield* agents.list()
            const data = list.map((agent) => ({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              model: agent.model,
              enabled: agent.enabled !== false,
              visibility: agent.visibility ?? "private",
              tools: agent.mcpServers ?? [],
              agentUrl: `/agentui/${agent.id}/edit`,
            }))
            return result("Agentes do AgentUI", ok({ agents: data, group: "Agentes", groupUrl: "/agentui" }))
          }

          if (params.action === "get") {
            if (!params.agentId) {
              return result(
                "Agente inválido",
                fail("INVALID_INPUT", "O parâmetro 'agentId' é obrigatório para a ação 'get'.", {
                  field: "agentId",
                }),
              )
            }
            const found = yield* agents.get(params.agentId)
            if (!found) {
              return result(
                "Agente não encontrado",
                fail("AGENT_NOT_FOUND", `Agente '${params.agentId}' não foi encontrado.`, {
                  agentId: params.agentId,
                }),
              )
            }
            yield* Effect.logInfo("agentui.get", {
              agentId: found.id,
              actor: ctx.agent,
              sessionID: ctx.sessionID,
            })
            return result(`Agente: ${found.name}`, ok(found), {
              agentId: found.id,
              agentUrl: `/agentui/${found.id}/edit`,
            })
          }

          const built = buildAgentInput(params)
          if (!built.ok) return result("Agente inválido", built, { field: built.error.details?.field })
          const agent = built.data

          const list = yield* agents.list()
          const duplicate = list.find(
            (item) => item.name.trim().toLowerCase() === agent.name.toLowerCase(),
          )
          if (duplicate) {
            return result(
              "Agente duplicado",
              fail("AGENT_DUPLICATE", "Já existe um agente com este nome.", {
                existingId: duplicate.id,
                name: agent.name,
              }),
              { agentId: duplicate.id },
            )
          }

          const created = yield* agents.add(agent).pipe(
            Effect.map((value) =>
              ok({
                agentId: value.id,
                agentUrl: `/agentui/${value.id}/edit`,
                group: "Agentes",
                groupUrl: "/agentui",
                status: "created" as const,
              }),
            ),
            Effect.catchCause((cause) =>
              Effect.gen(function* () {
                yield* Effect.logError("agentui.create failed", { cause })
                return fail("INVALID_INPUT", "Não foi possível criar o agente no AgentUI.")
              }),
            ),
          )

          if (!created.ok) return result("Falha ao criar agente", created)

          yield* Effect.logInfo("agentui.create", {
            agentId: created.data.agentId,
            actor: ctx.agent,
            sessionID: ctx.sessionID,
            callID: ctx.callID,
            visibility: agent.visibility,
          })
          yield* appendAudit(storage, {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            action: "create",
            actor: ctx.agent,
            sessionID: ctx.sessionID,
            agentId: created.data.agentId,
            result: "created",
          }).pipe(
            Effect.catchCause((cause) => Effect.logWarning("agentui tool audit failed", { cause })),
            Effect.asVoid,
          )

          return result("Agente criado", created, {
            agentId: created.data.agentId,
            agentUrl: created.data.agentUrl,
          })
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.gen(function* () {
              yield* Effect.logError("agentui tool failed", { cause })
              return result("Erro interno", fail("INTERNAL_ERROR", "Não foi possível concluir a operação."))
            }),
          ),
        ),
    }
  }),
)
