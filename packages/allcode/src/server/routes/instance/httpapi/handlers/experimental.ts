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
import { PromptEnhance } from "@/session/prompt-enhance"
import { MessageID, SessionID } from "@/session/schema"
import type { SessionV1 } from "@allcode/core/v1/session"
import { ToolJsonSchema } from "@/tool/json-schema"
import { ToolRegistry } from "@/tool/registry"
import { Worktree } from "@/worktree"
import { Memory } from "@/memory"
import { Provider } from "@/provider/provider"
import { Combo } from "@/combo"
import { generateText } from "ai"
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
import { Effect, Exit, Option } from "effect"
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
          const role = msg.info.role === "user" ? "User" : "Assistant"
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
      const projectMemory = ctx.payload.directory
        ? (yield* memory.loadProject(ctx.payload.directory).pipe(Effect.orElseSucceed(() => ({ content: "" })))).content
            .trim()
            .slice(-2500)
        : ""
      const globalMemory = (yield* memory.loadGlobal().pipe(Effect.orElseSucceed(() => ({ content: "" })))).content
        .trim()
        .slice(-2000)

      const promptContent = PromptEnhance.build({
        prompt: userPrompt,
        context: contextLines,
        projectMemory,
        globalMemory,
      })

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

      const fail = (error: PromptEnhance.Failure) =>
        Effect.logWarning("prompt enhance failed", {
          provider: error.provider,
          model: error.model,
          reason: error.reason,
          retryable: error.retryable,
          message: error.message,
        }).pipe(
          Effect.andThen(
            Effect.fail(
              new InvalidRequestError({
                message: `Prompt enhancement failed (${error.provider}/${error.model}): ${error.message}`,
                provider: error.provider,
                model: error.model,
                reason: error.reason,
                retryable: error.retryable,
              }),
            ),
          ),
        )

      // 3. Resolve através do modelo do Provider/Catalog
      const resolvedModel: Provider.Model | undefined =
        targetProviderID && targetModelID
          ? yield* getModel(targetProviderID, targetModelID, ctx.payload.directory)
          : undefined

      // 4. Fallback direto para Google Antigravity quando o catalog v2 ainda
      // não sincronizou o modelo. O adapter agora agrega todos os chunks SSE
      // (antes só o primeiro fragmento era lido, truncando a resposta).
      if (!resolvedModel) {
        const isAntigravity =
          targetProviderID === "google-antigravity" || targetProviderID === "google-antigravity-cli"
        if (isAntigravity) {
          const profile: "ide" | "cli" = targetProviderID === "google-antigravity-cli" ? "cli" : "ide"
          const live = yield* Effect.tryPromise(() => getLiveToken(targetProviderID, profile)).pipe(
            Effect.orElseSucceed(() => undefined),
          )

          if (live && !live.exhausted && live.token) {
            const outcome = yield* PromptEnhance.run({
              provider: targetProviderID,
              model: targetModelID,
              attempt: Effect.tryPromise({
                try: async () => {
                  const google = createGoogleGenerativeAI({
                    apiKey: "antigravity-oauth",
                    baseURL: "https://daily-cloudcode-pa.googleapis.com/v1internal",
                    fetch: createAntigravityFetch(profile) as any,
                  })
                  // Pass the user-facing alias (e.g. gemini-3.8-flash-high) so
                  // the adapter can map it AND apply the matching thinking
                  // budget. Passing the already-aliased id disabled that.
                  const result = await generateText({
                    model: google.languageModel(targetModelID),
                    system: PromptEnhance.SYSTEM.join("\n\n"),
                    prompt: promptContent,
                    temperature: 0.3,
                    // Generous cap: AGY's reasoning models spend part of the
                    // budget on thinking. Truncation is still detected below
                    // (finishReason === "length") instead of returning a
                    // partial prompt.
                    maxOutputTokens: 32_768,
                    // Never leave the UI busy forever if the upstream stalls.
                    abortSignal: AbortSignal.timeout(120_000),
                  })
                  return {
                    text: result.text,
                    finishReason: PromptEnhance.fromAI(result.finishReason),
                  }
                },
                catch: (error) => error,
              }),
            })
            if (!outcome.ok) return yield* fail(outcome.error)
            return { enhancedPrompt: outcome.text }
          }
        }

        return yield* fail({
          reason: "modelUnavailable",
          provider: targetProviderID || "unknown",
          model: targetModelID || ctx.payload.model || "unknown",
          message: "The model could not be resolved or authenticated. Check the provider credentials in settings.",
          retryable: false,
        })
      }

      // 5. Executa via LLM.Service (mesmo motor do chat). No tools are sent:
      // enhancement is pure text-in/text-out, and tool-capable models used to
      // stop mid-answer when they decided to call one.
      const sessID = ctx.payload.sessionID ?? SessionID.descending()
      const enhanceAgent: Agent.Info = {
        name: "build",
        mode: "primary",
        permission: [],
        options: {},
        native: true,
        prompt: "You are a prompt engineering expert.",
      }
      const userMessage: SessionV1.User = {
        id: MessageID.ascending(),
        sessionID: sessID,
        role: "user",
        time: { created: Date.now() },
        agent: enhanceAgent.name,
        model: { providerID: resolvedModel.providerID, modelID: resolvedModel.id },
      }

      const outcome = yield* PromptEnhance.run({
        provider: resolvedModel.providerID,
        model: resolvedModel.id,
        attempt: PromptEnhance.collect(
          llm.stream({
            agent: enhanceAgent,
            user: userMessage,
            system: PromptEnhance.SYSTEM,
            tools: {},
            model: resolvedModel,
            sessionID: sessID,
            retries: 2,
            messages: [{ role: "user", content: promptContent }],
          }),
        ),
      })

      if (!outcome.ok) return yield* fail(outcome.error)
      return { enhancedPrompt: outcome.text }
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
