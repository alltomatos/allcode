import { Catalog } from "@allcode/core/catalog"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { ProviderNotFoundError } from "@allcode/protocol/errors"
import { response } from "../location"

function cleanProvider(provider: any) {
  if (provider?.api?.settings && typeof provider.api.settings === "object") {
    const { fetch: _, ...safeSettings } = provider.api.settings
    return {
      ...provider,
      api: {
        ...provider.api,
        settings: safeSettings,
      },
    }
  }
  return provider
}

export const ProviderHandler = HttpApiBuilder.group(Api, "server.provider", (handlers) =>
  Effect.gen(function* () {
    return handlers
      .handle(
        "provider.list",
        Effect.fn(function* () {
          const catalog = yield* Catalog.Service
          const list = yield* catalog.provider.available()
          return yield* response(Effect.succeed(list.map(cleanProvider)))
        }),
      )
      .handle(
        "provider.get",
        Effect.fn(function* (ctx) {
          const catalog = yield* Catalog.Service
          const provider = yield* catalog.provider.get(ctx.params.providerID)
          if (!provider)
            return yield* new ProviderNotFoundError({
              providerID: ctx.params.providerID,
              message: `Provider not found: ${ctx.params.providerID}`,
            })
          return yield* response(Effect.succeed(cleanProvider(provider)))
        }),
      )
  }),
)
