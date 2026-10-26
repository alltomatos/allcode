import { Database } from "@allcode/core/database/database"
import { EventV2 } from "@allcode/core/event"
import type { LocationServices } from "@allcode/core/location-services"
import { LocationServiceMap } from "@allcode/core/location-service-map"
import { Location } from "@allcode/core/location"
import { Effect, Layer, LayerMap } from "effect"
import { location } from "./location"

/**
 * Location services apoiados nos serviços em memória do teste.
 *
 * `SessionV2.locate` resolve o banco da sessão por `LocationServiceMap.get(ref)`
 * e grava ali a admissão e o histórico. Os testes usam `Database.node` em
 * memória, então o mapa precisa devolver a MESMA instância — o default do
 * produto (`Database.locationNode(hash)`) abre um arquivo em `workspaces/`, e o
 * teste acabaria lendo um banco enquanto o produto escreve em outro.
 *
 * O layer é mínimo de propósito: montar `locationServices` inteiro aqui sobe
 * watchers e PTYs por teste e derruba o processo do Bun.
 */
export const testLocationServiceMap = Layer.unwrap(
  Effect.map(Effect.all([Database.Service, EventV2.Service]), ([database, events]) =>
    Layer.effect(
      LocationServiceMap.Service,
      LayerMap.make((ref: Location.Ref) =>
        Layer.mergeAll(
          Layer.succeed(Database.Service, database),
          Layer.succeed(EventV2.Service, events),
          Layer.succeed(Location.Service, Location.Service.of(location(ref))),
        ) as unknown as Layer.Layer<LocationServices>,
      ),
    ),
  ),
)

export { LocationServiceMap }
