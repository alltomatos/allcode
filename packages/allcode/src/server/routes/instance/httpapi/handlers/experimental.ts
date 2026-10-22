import { Account } from "@/account/account"
import { Agent } from "@/agent/agent"
import { BackgroundJob } from "@/background/job"
import { Config } from "@/config/config"
import { InstanceState } from "@/effect/instance-state"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { MCP } from "@/mcp"
import { Project } from "@/project/project"
import { Session } from "@/session/session"
import { LLM } from "@/session/llm"
import { LLMEvent } from "@allcode/llm"
import * as Stream from "effect/Stream"
import { MessageID, SessionID } from "@/session/schema"
import type { SessionV1 } from "@allcode/core/v1/session"
import { ToolJsonSchema } from "@/tool/json-schema"
import { ToolRegistry } from "@/tool/registry"
import { Worktree } from "@/worktree"
import { Memory } from "@/memory"
import { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import { Combo } from "@/combo"
import { generateText, jsonSchema, tool as aiTool } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createAntigravityFetch, getLiveToken } from "@/provider/antigravity-adapter"
import { Catalog } from "@allcode/core/catalog"
import { PluginInternal } from "@allcode/core/plugin/internal"
import { Integration } from "@allcode/core/integration"
import { IntegrationRotation } from "@allcode/core/integration/rotation"
import { LocationServiceMap } from "@allcode/core/location-services"
import { Location } from "@allcode/core/location"
import { AbsolutePath } from "@allcode/core/schema"
import { ProviderV2 } from "@allcode/core/provider"
import { ModelV2 } from "@allcode/core/model"
import { Cause, Effect, Exit, Option } from "effect"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { InvalidRequestError } from "../errors"
import { ConsoleSwitchPayload, EnhancePromptPayload, SessionListQuery, ToolListQuery, WorktreeApiError } from "../groups/experimental"

function mapWorktreeError<A, R>(self: Effect.Effect<A, Worktree.Error, R>) {
  return self.pipe(
    Effect.mapError((error) => new WorktreeApiError({ name: error._tag, data: { message: error.message } })),
  )
}

export const experimentalHandlers = HttpApiBuilder.group(InstanceHttpApi, "experimental", (handlers) =>
  Effect.gen(function* () {
    const account = yield* Account.Service
    const agents = yield* Agent.Service
    const config = yield* Config.Service
    const mcp = yield* MCP.Service
    const project = yield* Project.Service
    const registry = yield* ToolRegistry.Service
    const worktreeSvc = yield* Worktree.Service
    const sessions = yield* Session.Service
    const background = yield* BackgroundJob.Service
    const flags = yield* RuntimeFlags.Service
    const memory = yield* Memory.Service
    const provider = yield* Provider.Service
    const combos = yield* Combo.Service
    const locations = yield* LocationServiceMap.Service
    const llm = yield* LLM.Service

    const capabilities = Effect.fn("ExperimentalHttpApi.capabilities")(function* () {
      return { backgroundSubagents: flags.experimentalBackgroundSubagents }
    })

    const getConsole = Effect.fn("ExperimentalHttpApi.console")(function* () {
      const [state, groups] = yield* Effect.all(
        [
          config.getConsoleState(),
          account.orgsByAccount().pipe(Effect.catch(() => Effect.fail(new HttpApiError.InternalServerError({})))),
        ],
        {
          concurrency: "unbounded",
        },
      )
      return {
        consoleManagedProviders: state.consoleManagedProviders,
        ...(state.activeOrgName ? { activeOrgName: state.activeOrgName } : {}),
        switchableOrgCount: groups.reduce((count, group) => count + group.orgs.length, 0),
      }
    })

    const listConsoleOrgs = Effect.fn("ExperimentalHttpApi.consoleOrgs")(function* () {
      const [groups, active] = yield* Effect.all(
        [
          account.orgsByAccount().pipe(Effect.catch(() => Effect.fail(new HttpApiError.InternalServerError({})))),
          account.active().pipe(Effect.catch(() => Effect.fail(new HttpApiError.InternalServerError({})))),
        ],
        {
          concurrency: "unbounded",
        },
      )
      const info = Option.getOrUndefined(active)
      return {
        orgs: groups.flatMap((group) =>
          group.orgs.map((org) => ({
            accountID: group.account.id,
            accountEmail: group.account.email,
            accountUrl: group.account.url,
            orgID: org.id,
            orgName: org.name,
            active: !!info && info.id === group.account.id && info.active_org_id === org.id,
          })),
        ),
      }
    })

    const switchConsole = Effect.fn("ExperimentalHttpApi.consoleSwitch")(function* (ctx: {
      payload: typeof ConsoleSwitchPayload.Type
    }) {
      yield* account
        .use(ctx.payload.accountID, Option.some(ctx.payload.orgID))
        .pipe(Effect.catch(() => Effect.fail(new HttpApiError.BadRequest({}))))
      return true
    })

    const tool = Effect.fn("ExperimentalHttpApi.tool")(function* (ctx: { query: typeof ToolListQuery.Type }) {
      const list = yield* registry.tools({
        providerID: ctx.query.provider,
        modelID: ctx.query.model,
        agent: yield* agents.defaultInfo(),
      })
      return list.map((item) => ({
        id: item.id,
        description: item.description,
        parameters: ToolJsonSchema.fromTool(item),
      }))
    })

    const toolIDs = Effect.fn("ExperimentalHttpApi.toolIDs")(function* () {
      return yield* registry.ids()
    })

    const worktree = Effect.fn("ExperimentalHttpApi.worktree")(function* () {
      const ctx = yield* InstanceState.context
      return yield* project.sandboxes(ctx.project.id)
    })

    const worktreeCreate = Effect.fn("ExperimentalHttpApi.worktreeCreate")(function* (ctx: {
      payload: typeof Worktree.CreateInput.Type | void
    }) {
      return yield* mapWorktreeError(worktreeSvc.create(ctx.payload ?? undefined))
    })

    const worktreeRemove = Effect.fn("ExperimentalHttpApi.worktreeRemove")(function* (input: {
      payload: Worktree.RemoveInput
    }) {
      const ctx = yield* InstanceState.context
      yield* mapWorktreeError(worktreeSvc.remove(input.payload))
      yield* project.removeSandbox(ctx.project.id, input.payload.directory)
      return true
    })

    const worktreeReset = Effect.fn("ExperimentalHttpApi.worktreeReset")(function* (ctx: {
      payload: Worktree.ResetInput
    }) {
      yield* mapWorktreeError(worktreeSvc.reset(ctx.payload))
      return true
    })

    const session = Effect.fn("ExperimentalHttpApi.session")(function* (ctx: { query: typeof SessionListQuery.Type }) {
      const limit = ctx.query.limit ?? 100
      const directory = ctx.query.directory ? yield* InstanceState.directory : undefined
      const all = yield* sessions.listGlobal({
        directory,
        roots: ctx.query.roots,
        start: ctx.query.start,
        cursor: ctx.query.cursor,
        search: ctx.query.search,
        limit: limit + 1,
        archived: ctx.query.archived,
      })
      const list = all.length > limit ? all.slice(0, limit) : all
      return HttpServerResponse.jsonUnsafe(list, {
        headers:
          all.length > limit && list.length > 0
            ? { "x-next-cursor": String(list[list.length - 1].time.updated) }
            : undefined,
      })
    })

    const sessionBackground = Effect.fn("ExperimentalHttpApi.sessionBackground")(function* (ctx: {
      params: { sessionID: SessionID }
    }) {
      if (!flags.experimentalBackgroundSubagents) return false
      const jobs = (yield* background.list()).filter(
        (job) =>
          job.type === "task" &&
          job.status === "running" &&
          job.metadata?.parentSessionId === ctx.params.sessionID &&
          job.metadata.background !== true,
      )
      const promoted = yield* Effect.forEach(jobs, (job) => background.promote(job.id), { concurrency: "unbounded" })
      return promoted.some((job) => job !== undefined)
    })

    const backgroundJob = Effect.fn("ExperimentalHttpApi.backgroundJob")(function* () {
      return yield* background.list()
    })

    const backgroundJobCancel = Effect.fn("ExperimentalHttpApi.backgroundJobCancel")(function* (ctx: {
      params: { id: string }
    }) {
      const result = yield* background.cancel(ctx.params.id)
      return result !== undefined
    })

    const resource = Effect.fn("ExperimentalHttpApi.resource")(function* () {
      return yield* mcp.resources()
    })

    const syncFromCatalog = Effect.fnUntraced(function* (
      providerID: ProviderV2.ID,
      modelID: ModelV2.ID,
      directory?: string,
    ) {
      const dir = directory ?? (yield* InstanceState.directory.pipe(Effect.orElseSucceed(() => undefined)))
      if (!dir) return false
      return yield* Effect.gen(function* () {
        const internal = yield* PluginInternal.Service
        yield* internal.ready.pipe(Effect.timeout("5 seconds"), Effect.catch(() => Effect.void))
        const catalog = yield* Catalog.Service
        const integrations = yield* Integration.Service
        const model = yield* catalog.model.get(providerID, modelID)
        if (!model) return false
        const catalogProvider = yield* catalog.provider.get(providerID)
        if (!catalogProvider) return false
        const integrationID = catalogProvider.integrationID ?? Integration.ID.make(providerID)
        const connections = yield* integrations.connection.list(integrationID)
        const picked = IntegrationRotation.pick(integrationID, connections)
        const credential = picked ? yield* integrations.connection.resolve(picked) : undefined
        yield* provider.syncCatalogModel(providerID, catalogProvider, [model], credential)
        return true
      }).pipe(
        Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(dir) }))),
        Effect.catch(() => Effect.succeed(false)),
      )
    })

    const MODEL_ALIASES: Record<string, string> = {
      "gemini-3.8-flash-high": "gemini-3.8-flash-tiered",
      "gemini-3.8-flash-medium": "gemini-3.8-flash-tiered",
      "gemini-3.8-flash-low": "gemini-3.8-flash-tiered",
      "gemini-3.7-flash-high": "gemini-3.7-flash-tiered",
      "gemini-3.7-flash-medium": "gemini-3.7-flash-tiered",
      "gemini-3.7-flash-low": "gemini-3.7-flash-tiered",
      "gemini-3.1-pro-high": "gemini-pro-agent",
    }

    const getModel = Effect.fnUntraced(function* (
      targetProviderID: string,
      targetModelID: string,
      directory?: string,
    ) {
      let providerID = targetProviderID
      let modelID = targetModelID

      if (providerID === "combo") {
        const resolved = yield* combos.resolve(modelID).pipe(Effect.orElseSucceed(() => undefined))
        if (!resolved) return undefined
        providerID = resolved.providerID
        modelID = resolved.modelID
      }

      const exit = yield* provider.getModel(providerID as any, modelID as any).pipe(Effect.exit)
      if (Exit.isSuccess(exit)) return exit.value

      const synced = yield* syncFromCatalog(providerID as any, modelID as any, directory)
      if (synced) {
        const retry = yield* provider.getModel(providerID as any, modelID as any).pipe(Effect.exit)
        if (Exit.isSuccess(retry)) return retry.value
      }

      return undefined
    })

    const enhancePrompt = Effect.fn("ExperimentalHttpApi.enhancePrompt")(function* (ctx: {
      payload: typeof EnhancePromptPayload.Type
    }) {
      const userPrompt = ctx.payload.prompt.trim()
      if (!userPrompt) {
        return yield* Effect.fail(new HttpApiError.BadRequest({}))
      }

      // Contexto recente da conversa
      const contextLines: string[] = []
      if (ctx.payload.sessionID) {
        const msgs = yield* sessions.messages({ sessionID: ctx.payload.sessionID, limit: 10 }).pipe(Effect.orElseSucceed(() => []))
        for (const msg of msgs) {
          const role = msg.info.role === "user" ? "Usuário" : "Assistente"
          const textParts: string[] = []
          for (const part of msg.parts) {
            if ("text" in part && typeof part.text === "string" && part.text.trim()) {
              textParts.push(part.text.trim())
            }
          }
          if (textParts.length > 0) {
            contextLines.push(`${role}: ${textParts.join("\n").slice(0, 1500)}`)
          }
        }
      }

      // Memória do projeto e memória global
      let memoryContext = ""
      if (ctx.payload.directory) {
        const projMem = yield* memory.loadProject(ctx.payload.directory).pipe(Effect.orElseSucceed(() => ({ content: "" })))
        if (projMem.content.trim()) {
          memoryContext += `[Memória do Projeto]:\n${projMem.content.trim().slice(-2500)}\n\n`
        }
      }
      const globMem = yield* memory.loadGlobal().pipe(Effect.orElseSucceed(() => ({ content: "" })))
      if (globMem.content.trim()) {
        memoryContext += `[Memória Global/Preferências]:\n${globMem.content.trim().slice(-2000)}\n\n`
      }

      const systemPrompt =
        "Você é um engenheiro de prompt e arquiteto de software sênior de elite.\n" +
        "Sua única tarefa é entender o contexto da conversa, a memória e o rascunho do usuário, e reescrever o rascunho em um prompt aprimorado, muito mais claro, rico em detalhes técnicos essenciais e eficaz para o assistente de programação.\n\n" +
        "Regras inegociáveis:\n" +
        "1. Retorne APENAS o texto do prompt melhorado. Jamais inclua preâmbulos, saudações, explicações (como 'Aqui está o prompt:', 'Sugestão:', etc.) ou aspas ao redor.\n" +
        "2. Mantenha estritamente o mesmo idioma do usuário (ex: português do Brasil se o usuário escreveu em português).\n" +
        "3. Seja direto, preciso e estruturado. Indique claramente o objetivo, requisitos funcionais, comportamentos esperados e restrições técnicas cabíveis ao contexto.\n" +
        "4. Preserve qualquer comando (ex: /refactor, /test) ou menção a arquivo (@caminho) presente no rascunho.\n" +
        "5. Não responda ao pedido nem execute a tarefa técnica. Apenas devolva a instrução aprimorada."

      let promptContent = ""
      if (contextLines.length > 0) {
        promptContent += `### Histórico recente da conversa:\n${contextLines.slice(-6).join("\n\n")}\n\n`
      }
      if (memoryContext.trim()) {
        promptContent += `### Memória e contexto do projeto:\n${memoryContext}\n`
      }
      promptContent += `### Prompt em rascunho a ser melhorado:\n"${userPrompt}"`

      // 1. Tenta resolver o modelo solicitado
      let targetProviderID = ""
      let targetModelID = ""
      if (ctx.payload.model && ctx.payload.model.trim()) {
        const spec = ctx.payload.model.trim()
        const separator = spec.indexOf("/")
        if (separator > 0) {
          targetProviderID = spec.slice(0, separator)
          targetModelID = spec.slice(separator + 1)
        }
      }

      // 2. Se não especificado no payload, tenta a sessão existente
      if (!targetProviderID && ctx.payload.sessionID) {
        const sess = yield* sessions.get(ctx.payload.sessionID).pipe(Effect.orElseSucceed(() => undefined))
        if (sess?.model) {
          targetProviderID = sess.model.providerID
          targetModelID = sess.model.id
        }
      }

      // 3. Fallback: Se for Google Antigravity direto (sem catalog v2 sync)
      if (targetProviderID === "google-antigravity" || targetProviderID === "google-antigravity-cli") {
        const profile: "ide" | "cli" = targetProviderID === "google-antigravity-cli" ? "cli" : "ide"
        const integrationID = profile === "cli" ? "google-antigravity-cli" : "google-antigravity"
        const live = (yield* Effect.tryPromise(() => getLiveToken(integrationID, profile)).pipe(
          Effect.orElseSucceed(() => undefined),
        )) as { token?: string; exhausted?: boolean } | undefined
        if (live && !live.exhausted && live.token) {
          try {
            const google = createGoogleGenerativeAI({
              apiKey: "antigravity-oauth",
              baseURL: "https://daily-cloudcode-pa.googleapis.com/v1internal",
              fetch: createAntigravityFetch(profile) as any,
            })
            const actualModel = MODEL_ALIASES[targetModelID] || targetModelID
            const directRes: { text: string } = yield* Effect.tryPromise({
              try: () =>
                generateText({
                  model: google.languageModel(actualModel),
                  system: systemPrompt,
                  prompt: promptContent,
                  temperature: 0.3,
                }),
              catch: (err) =>
                new InvalidRequestError({
                  message: `Erro ao gerar prompt com Google Antigravity: ${err instanceof Error ? err.message : String(err)}`,
                }),
            })
            let enhanced = directRes.text.trim()
            if ((enhanced.startsWith('"') && enhanced.endsWith('"')) || (enhanced.startsWith("'") && enhanced.endsWith("'"))) {
              enhanced = enhanced.slice(1, -1).trim()
            }
            if (enhanced.startsWith("```") && enhanced.endsWith("```")) {
              enhanced = enhanced.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim()
            }
            return { enhancedPrompt: enhanced || userPrompt }
          } catch (e: any) {
            return yield* Effect.fail(
              new InvalidRequestError({
                message: `Falha no Google Antigravity: ${e?.message ?? String(e)}`,
              }),
            )
          }
        }
      }

      // 4. Resolve através do modelo do Provider/Catalog
      let resolvedModel: Provider.Model | undefined = undefined
      if (targetProviderID && targetModelID) {
        resolvedModel = yield* getModel(targetProviderID, targetModelID, ctx.payload.directory)
      }

      if (!resolvedModel) {
        return yield* Effect.fail(
          new InvalidRequestError({
            message: `Não foi possível encontrar ou autenticar o modelo '${ctx.payload.model || targetModelID || "selecionado"}'. Verifique as credenciais do provedor nas configurações.`,
          }),
        )
      }

      // 5. Executa via LLM.Service nativo (mesmo motor do chat)
      const sessID = ctx.payload.sessionID ?? SessionID.descending()
      const enhanceAgent: Agent.Info = {
        name: "build",
        mode: "primary",
        permission: [],
        options: {},
        native: true,
        prompt: "Você é um especialista em engenharia de prompt.",
      }
      const userMessage: SessionV1.User = {
        id: MessageID.ascending(),
        sessionID: sessID,
        role: "user",
        time: { created: Date.now() },
        agent: enhanceAgent.name,
        model: { providerID: resolvedModel.providerID, modelID: resolvedModel.id },
      }

      // Constrói os tools no formato AI SDK válido para satisfazer o fingerprint dos provedores (ex: OpenCode free tier)
      const resolvedTools: Record<string, any> = {}
      for (const item of yield* registry.tools({
        modelID: ModelV2.ID.make(resolvedModel.api.id),
        providerID: resolvedModel.providerID,
        agent: enhanceAgent,
      })) {
        const schema = ProviderTransform.schema(resolvedModel, ToolJsonSchema.fromTool(item))
        resolvedTools[item.id] = aiTool({
          description: item.description,
          inputSchema: jsonSchema(schema),
          async execute() {
            return "ok"
          },
        })
      }

      const resultText = yield* llm
        .stream({
          agent: enhanceAgent,
          user: userMessage,
          system: [
            systemPrompt,
            "NOTA: As ferramentas disponíveis são informativas. NÃO invoque nenhuma ferramenta. Responda diretamente e exclusivamente com o texto do prompt aprimorado.",
          ],
          tools: resolvedTools,
          toolChoice: "auto",
          model: resolvedModel,
          sessionID: sessID,
          retries: 2,
          messages: [{ role: "user", content: promptContent }],
        })
        .pipe(
          Stream.filter(LLMEvent.is.textDelta),
          Stream.map((event) => event.text),
          Stream.mkString,
          Effect.catchCause((cause) => {
            const errStr = Cause.pretty(cause)
            return Effect.fail(new InvalidRequestError({ message: `Erro ao gerar prompt com IA: ${errStr}` }))
          }),
        )

      let enhanced = resultText.trim()
      if ((enhanced.startsWith('"') && enhanced.endsWith('"')) || (enhanced.startsWith("'") && enhanced.endsWith("'"))) {
        enhanced = enhanced.slice(1, -1).trim()
      }
      if (enhanced.startsWith("```") && enhanced.endsWith("```")) {
        enhanced = enhanced.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim()
      }

      return { enhancedPrompt: enhanced || userPrompt }
    })

    return handlers
      .handle("capabilities", capabilities)
      .handle("console", getConsole)
      .handle("consoleOrgs", listConsoleOrgs)
      .handle("consoleSwitch", switchConsole)
      .handle("tool", tool)
      .handle("toolIDs", toolIDs)
      .handle("worktree", worktree)
      .handle("worktreeCreate", worktreeCreate)
      .handle("worktreeRemove", worktreeRemove)
      .handle("worktreeReset", worktreeReset)
      .handle("session", session)
      .handle("sessionBackground", sessionBackground)
      .handle("backgroundJob", backgroundJob)
      .handle("backgroundJobCancel", backgroundJobCancel)
      .handle("resource", resource)
      .handle("enhancePrompt", enhancePrompt)
  }),
)
