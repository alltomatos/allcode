export * as AgentUIStore from "./store"

import { Context, Effect, Layer } from "effect"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { ConfigV1 } from "@allcode/core/v1/config/config"
import type { ConfigAgentUIV1 } from "@allcode/core/v1/config/agentui"
import { Config } from "@/config/config"

export interface Interface {
  readonly list: () => Effect.Effect<ConfigAgentUIV1.Agent[]>
  readonly get: (id: string) => Effect.Effect<ConfigAgentUIV1.Agent | undefined>
  readonly add: (agent: ConfigAgentUIV1.Agent) => Effect.Effect<ConfigAgentUIV1.Agent>
  readonly remove: (id: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/AgentUIStore") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const cfgSvc = yield* Config.Service

    // Same overlay-on-top-of-disk-config pattern as Combo.Service (src/combo/index.ts)
    // — Config.Service.updateGlobal only invalidates its own global cache, not
    // the per-instance merged view Config.Service.get() reads.
    const overlay = new Map<string, ConfigAgentUIV1.Agent | undefined>()

    const list = Effect.fn("AgentUIStore.list")(function* () {
      const cfg = yield* cfgSvc.get().pipe(
        Effect.catchDefect((defect) => {
          if (defect instanceof Error && defect.message.includes("InstanceRef not provided")) {
            return cfgSvc.getGlobal()
          }
          return Effect.die(defect)
        }),
      )
      const merged = new Map<string, ConfigAgentUIV1.Agent>(Object.entries(cfg.agentui ?? {}))
      for (const [id, agent] of overlay) {
        if (agent) merged.set(id, agent)
        else merged.delete(id)
      }
      return Array.from(merged.values())
    })

    const get = Effect.fn("AgentUIStore.get")(function* (id: string) {
      const agents = yield* list()
      return agents.find((agent) => agent.id === id)
    })

    const add = Effect.fn("AgentUIStore.add")(function* (agent: ConfigAgentUIV1.Agent) {
      overlay.set(agent.id, agent)
      yield* cfgSvc.updateGlobal({ agentui: { [agent.id]: agent } } as unknown as ConfigV1.Info)
      return agent
    })

    const remove = Effect.fn("AgentUIStore.remove")(function* (id: string) {
      overlay.set(id, undefined)
      yield* cfgSvc.updateGlobal({ agentui: { [id]: undefined } } as unknown as ConfigV1.Info)
    })

    return Service.of({ list, get, add, remove })
  }),
)

export const node = LayerNode.make({ service: Service, layer, deps: [Config.node] })
