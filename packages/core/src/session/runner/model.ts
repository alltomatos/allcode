export * as SessionRunnerModel from "./model"

import { makeLocationNode } from "../../effect/app-node"
import { type Model } from "@allcode/llm"
import * as AnthropicMessages from "@allcode/llm/protocols/anthropic-messages"
import * as OpenAICompatibleChat from "@allcode/llm/protocols/openai-compatible-chat"
import * as OpenAIResponses from "@allcode/llm/protocols/openai-responses"
import * as OpenRouter from "@allcode/llm/providers/openrouter"
import { Auth, type AnyRoute } from "@allcode/llm/route"
import { Context, Effect, Layer, Schema } from "effect"
import { produce } from "immer"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../../config"
import { Catalog } from "../../catalog"
import { ComboSelect } from "../../combo/select"
import { Credential } from "../../credential"
import { Global } from "../../global"
import { Integration } from "../../integration"
import { IntegrationRotation } from "../../integration/rotation"
import { ModelV2 } from "../../model"
import { ProviderV2 } from "../../provider"
import { SessionSchema } from "../schema"

export class ModelNotSelectedError extends Schema.TaggedErrorClass<ModelNotSelectedError>()(
  "SessionRunnerModel.ModelNotSelectedError",
  {
    sessionID: SessionSchema.ID,
  },
) {
  override get message() {
    return `No model is available for session ${this.sessionID}`
  }
}

export class ModelUnavailableError extends Schema.TaggedErrorClass<ModelUnavailableError>()(
  "SessionRunnerModel.ModelUnavailableError",
  {
    providerID: ProviderV2.ID,
    modelID: ModelV2.ID,
  },
) {
  override get message() {
    return `Model unavailable: ${this.providerID}/${this.modelID}`
  }
}

export class VariantUnavailableError extends Schema.TaggedErrorClass<VariantUnavailableError>()(
  "SessionRunnerModel.VariantUnavailableError",
  {
    providerID: ProviderV2.ID,
    modelID: ModelV2.ID,
    variant: ModelV2.VariantID,
  },
) {
  override get message() {
    return `Variant unavailable for ${this.providerID}/${this.modelID}: ${this.variant}`
  }
}

export class UnsupportedApiError extends Schema.TaggedErrorClass<UnsupportedApiError>()(
  "SessionRunnerModel.UnsupportedApiError",
  {
    providerID: ProviderV2.ID,
    modelID: ModelV2.ID,
    api: Schema.String,
  },
) {
  override get message() {
    return `Unsupported API for ${this.providerID}/${this.modelID}: ${this.api}`
  }
}

export type Error =
  | ModelNotSelectedError
  | ModelUnavailableError
  | VariantUnavailableError
  | UnsupportedApiError
  | Integration.AuthorizationError

export interface Interface {
  readonly resolve: (session: SessionSchema.Info) => Effect.Effect<Model, Error>
  readonly reportFailure: (session: SessionSchema.Info, error: unknown) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/SessionRunnerModel") {}

/** Test or embedding seam for supplying a model resolver directly. */
export const layerWith = (
  resolve: Interface["resolve"],
  reportFailure: Interface["reportFailure"] = () => Effect.void,
) => Layer.succeed(Service, Service.of({ resolve, reportFailure }))

const apiKey = (model: ModelV2.Info, credential?: Credential.Value) => {
  if (credential?.type === "key") return Auth.value(credential.key)
  if (credential?.type === "oauth") return Auth.value(credential.access)
  const value = model.request.body.apiKey ?? model.api.settings?.apiKey
  if (typeof value === "string") return Auth.value(value)
}

type StoredAuth =
  | { readonly type: "api"; readonly key: string; readonly metadata?: Record<string, string> }
  | {
      readonly type: "oauth"
      readonly access: string
      readonly refresh: string
      readonly expires: number
      readonly accountId?: string
      readonly enterpriseUrl?: string
    }

/**
 * Legacy `auth.json` bridge for the v2 runner. Providers connected before the
 * Credential/Integration store (OpenRouter, AgentRouter, ...) only exist in
 * the legacy file. The v1 path reads it directly; the v2 runner must do the
 * same until every provider is migrated to the integration store.
 */
const legacyCredential = (providerID: ProviderV2.ID): Effect.Effect<Credential.Value | undefined> =>
  Effect.tryPromise({
    try: async () => {
      const source =
        process.env.OPENCODE_AUTH_CONTENT ?? (await fs.readFile(path.join(Global.Path.data, "auth.json"), "utf8"))
      const data = JSON.parse(source) as Record<string, StoredAuth>
      const entry = data[providerID]
      if (!entry) return undefined
      if (entry.type === "api" && typeof entry.key === "string") {
        return Credential.Key.make({
          type: "key",
          key: entry.key,
          metadata: entry.metadata,
        })
      }
      if (
        entry.type === "oauth" &&
        typeof entry.access === "string" &&
        typeof entry.refresh === "string" &&
        typeof entry.expires === "number"
      ) {
        return Credential.OAuth.make({
          type: "oauth",
          methodID: Integration.MethodID.make("legacy"),
          access: entry.access,
          refresh: entry.refresh,
          expires: entry.expires,
          metadata: {
            ...(entry.accountId === undefined ? {} : { accountId: entry.accountId }),
            ...(entry.enterpriseUrl === undefined ? {} : { enterpriseUrl: entry.enterpriseUrl }),
          },
        })
      }
      return undefined
    },
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined))

const withDefaults = (model: ModelV2.Info, route: AnyRoute) => {
  const body = model.request.body
  const httpBody = Object.hasOwn(body, "apiKey")
    ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== "apiKey"))
    : body
  return route.with({
    provider: model.providerID,
    endpoint: model.api.url === undefined ? undefined : { baseURL: model.api.url },
    headers: model.request.headers,
    http: { body: httpBody },
    limits: { context: model.limit.context, input: model.limit.input, output: model.limit.output },
  })
}

const withVariant = (
  model: ModelV2.Info,
  variantID: ModelV2.VariantID | undefined,
): Effect.Effect<ModelV2.Info, VariantUnavailableError> => {
  const id = variantID === "default" || variantID === undefined ? model.request.variant : variantID
  const variant = model.variants.find((item) => item.id === id)
  if (!variant && variantID !== undefined && variantID !== "default")
    return Effect.fail(
      new VariantUnavailableError({
        providerID: model.providerID,
        modelID: model.id,
        variant: variantID,
      }),
    )
  return Effect.succeed(
    variant
      ? produce(model, (draft) => {
          Object.assign(draft.request.headers, variant.headers)
          Object.assign(draft.request.body, variant.body)
        })
      : model,
  )
}

const apiName = (model: ModelV2.Info) =>
  model.api.type === "aisdk" ? `${model.api.type}:${model.api.package}` : model.api.type

export const fromCatalogModel = (
  model: ModelV2.Info,
  credential?: Credential.Value,
): Effect.Effect<Model, UnsupportedApiError> => {
  const resolved =
    credential?.type !== "key" || credential.metadata === undefined
      ? model
      : produce(model, (draft) => {
          Object.assign(draft.request.body, credential.metadata)
        })
  const key = apiKey(resolved, credential)
  if (resolved.api.type === "aisdk" && resolved.api.package === "@ai-sdk/openai") {
    return Effect.succeed(
      withDefaults(resolved, OpenAIResponses.route)
        .with({ auth: key === undefined ? Auth.none : Auth.bearer(key) })
        .model({ id: resolved.api.id }),
    )
  }
  if (resolved.api.type === "aisdk" && resolved.api.package === "@ai-sdk/anthropic") {
    return Effect.succeed(
      withDefaults(resolved, AnthropicMessages.route)
        .with({ auth: key === undefined ? Auth.none : Auth.header("x-api-key", key) })
        .model({ id: resolved.api.id }),
    )
  }
  if (resolved.api.type === "aisdk" && resolved.api.package === "@ai-sdk/openai-compatible" && resolved.api.url) {
    return Effect.succeed(
      withDefaults(resolved, OpenAICompatibleChat.route)
        .with({ auth: key === undefined ? Auth.none : Auth.bearer(key) })
        .model({ id: resolved.api.id }),
    )
  }
  if (resolved.api.type === "aisdk" && resolved.api.package === "@openrouter/ai-sdk-provider" && resolved.api.url) {
    return Effect.succeed(
      withDefaults(resolved, OpenRouter.route)
        .with({ auth: key === undefined ? Auth.none : Auth.bearer(key) })
        .model({ id: resolved.api.id }),
    )
  }
  return Effect.fail(
    new UnsupportedApiError({
      providerID: resolved.providerID,
      modelID: resolved.id,
      api: apiName(resolved),
    }),
  )
}

export const resolve = (session: SessionSchema.Info, model: ModelV2.Info, credential?: Credential.Value) =>
  withVariant(model, session.model?.variant).pipe(Effect.flatMap((model) => fromCatalogModel(model, credential)))

export const supported = (model: ModelV2.Info) =>
  model.api.type === "aisdk" &&
  (model.api.package === "@ai-sdk/openai" ||
    model.api.package === "@ai-sdk/anthropic" ||
    ((model.api.package === "@ai-sdk/openai-compatible" || model.api.package === "@openrouter/ai-sdk-provider") &&
      model.api.url !== undefined))

/** Resolves models from the catalog belonging to the current Location runtime. */
export const locationLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const catalog = yield* Catalog.Service
    const integrations = yield* Integration.Service
    const config = yield* Config.Service
    const lastFailed = new Map<string, string>()

    const resolveComboModel = (comboID: string) =>
      Effect.gen(function* () {
        const entries = yield* config.entries()
        const documents = entries.filter((entry): entry is Config.Document => entry.type === "document")
        let comboInfo: any
        for (const doc of documents) {
          if (doc.info.combo && doc.info.combo[comboID]) {
            comboInfo = doc.info.combo[comboID]
          }
        }
        if (!comboInfo || !comboInfo.models || comboInfo.models.length === 0) return undefined
        const sorted = [...comboInfo.models].sort((a: any, b: any) => (a.priority ?? 0) - (b.priority ?? 0))
        const skip = comboInfo.failover?.enabled ? lastFailed.get(comboID) : undefined
        // Filtro de disponibilidade: só considera membros que o catálogo expõe
        // agora. Com o catálogo ainda vazio (cold start), não bloqueia.
        const available = new Set(
          (yield* catalog.model.available()).map((model) => `${model.providerID}/${model.id}`),
        )
        const picked = ComboSelect.pickComboModel({
          ordered: sorted,
          skip,
          isSelectable:
            available.size === 0 ? undefined : (selection) => available.has(`${selection.providerID}/${selection.modelID}`),
        })
        if (!picked) return undefined
        return { providerID: ProviderV2.ID.make(picked.providerID), modelID: ModelV2.ID.make(picked.modelID) }
      })

    return Service.of({
      resolve: Effect.fn("SessionRunnerModel.resolve")(function* (session) {
        // Location plugins populate and filter the catalog asynchronously during layer startup.
        let targetProviderID = session.model?.providerID
        let targetModelID = session.model?.id

        if (targetProviderID === "combo" && targetModelID) {
          const resolvedCombo = yield* resolveComboModel(targetModelID)
          if (resolvedCombo) {
            targetProviderID = resolvedCombo.providerID
            targetModelID = resolvedCombo.modelID
          }
        }

        const defaultModel = session.model ? undefined : yield* catalog.model.default()
        const selected = targetProviderID && targetModelID
          ? (yield* catalog.model.available()).find(
              (model) => model.providerID === targetProviderID && model.id === targetModelID,
            )
          : defaultModel && supported(defaultModel)
            ? defaultModel
            : (yield* catalog.model.available()).find(supported)
        if (!selected && session.model)
          return yield* new ModelUnavailableError({
            providerID: session.model.providerID,
            modelID: session.model.id,
          })
        if (!selected) return yield* new ModelNotSelectedError({ sessionID: session.id })
        const provider = yield* catalog.provider.get(selected.providerID)
        const integrationID = provider?.integrationID ?? Integration.ID.make(selected.providerID)
        const connections = yield* integrations.connection.list(integrationID)
        const connection = IntegrationRotation.pick(integrationID, connections)
        const credential = connection
          ? yield* integrations.connection.resolve(connection)
          : yield* legacyCredential(selected.providerID)
        // The hosted OpenCode gateway accepts the documented anonymous "public"
        // key (v1's `opencode` loader uses it when no plan key is connected).
        // Without it the v2 runner sends no auth and the gateway answers 403
        // "Workspace selection is required" instead of serving free/public models.
        const fallback =
          credential ?? (selected.providerID === "opencode" ? Credential.Key.make({ type: "key", key: "public" }) : undefined)
        return yield* resolve(session, selected, fallback)
      }),
      reportFailure: Effect.fn("SessionRunnerModel.reportFailure")(function* (session, error) {
        if (session.model?.providerID === "combo" && session.model?.id) {
          const comboID = session.model.id
          const resolved = yield* resolveComboModel(comboID)
          if (resolved) {
            lastFailed.set(comboID, `${resolved.providerID}/${resolved.modelID}`)
          }
        }
        const defaultModel = session.model ? undefined : yield* catalog.model.default()
        const selected = session.model
          ? (yield* catalog.model.available()).find(
              (model) => model.providerID === session.model?.providerID && model.id === session.model.id,
            )
          : defaultModel && supported(defaultModel)
            ? defaultModel
            : (yield* catalog.model.available()).find(supported)
        if (!selected) return
        const provider = yield* catalog.provider.get(selected.providerID)
        const integrationID = provider?.integrationID ?? Integration.ID.make(selected.providerID)
        IntegrationRotation.handleFailure(integrationID, error)
      }),
    })
  }),
)

export const node = makeLocationNode({ service: Service, layer: locationLayer, deps: [Catalog.node, Integration.node, Config.node] })
