import { describe, expect } from "bun:test"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"
import { it } from "./lib/effect"

class Counter extends Context.Service<
  Counter,
  {
    readonly inc: () => Effect.Effect<number>
    readonly builds: () => Effect.Effect<number>
  }
>()("test/LazyCounter") {}

function counterLayer(onBuild: () => void) {
  return Layer.effect(
    Counter,
    Effect.sync(() => {
      onBuild()
      let value = 0
      return Counter.of({
        inc: () => Effect.sync(() => ++value),
        builds: () => Effect.sync(() => builds),
      })
    }),
  )
}

let builds = 0

describe("LayerNode lazy", () => {
  it.effect("defers construction until the first method call and then memoizes", () => {
    builds = 0
    const node = LayerNode.make({ service: Counter, layer: counterLayer(() => builds++), deps: [], lazy: true })
    return Effect.gen(function* () {
      expect(builds).toBe(0)
      const counter = yield* Counter
      expect(yield* counter.inc()).toBe(1)
      expect(yield* counter.inc()).toBe(2)
      expect(builds).toBe(1)
      expect(yield* counter.builds()).toBe(1)
    }).pipe(Effect.provide(LayerNode.compile(node)))
  })

  it.effect("builds eagerly when not marked lazy", () => {
    builds = 0
    const node = LayerNode.make({ service: Counter, layer: counterLayer(() => builds++), deps: [] })
    return Effect.gen(function* () {
      expect(builds).toBe(1)
      const counter = yield* Counter
      expect(yield* counter.inc()).toBe(1)
    }).pipe(Effect.provide(LayerNode.compile(node)))
  })
})
