import { Catalog } from "@allcode/core/catalog"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { response } from "../location"
import { cleanModel } from "./clean"
import { PluginInternal } from "@allcode/core/plugin/internal"

export const ModelHandler = HttpApiBuilder.group(Api, "server.model", (handlers) =>
  Effect.gen(function* () {
    return handlers.handle(
      "model.list",
      Effect.fn(function* () {
        // Location plugins populam o catálogo de forma assíncrona no boot. Sem
        // esperar aqui, o endpoint responde vazio no cold start e o cliente
        // cacheia essa lista (staleTime) — o legacy já faz essa espera.
        const internal = yield* PluginInternal.Service
        yield* internal.ready.pipe(Effect.timeout("20 seconds"), Effect.catch(() => Effect.void))
        const catalog = yield* Catalog.Service
        const models = yield* catalog.model.available()
        return yield* response(Effect.succeed(models.map(cleanModel)))
      }),
    )
  }),
)

