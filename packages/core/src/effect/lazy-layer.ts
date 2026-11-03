import { Context, Effect, Layer } from "effect"

/**
 * Wraps a service layer so that it is only built when one of its methods is
 * first used. The proxy itself is created during graph acquisition (cheap); the
 * underlying layer is built lazily with the surrounding build's `MemoMap` and
 * `Scope`, so dependencies that are already built are reused instead of being
 * instantiated twice.
 *
 * Only services whose members are Effect-returning methods are eligible; that
 * is the convention for every `Context.Service` in this codebase.
 */
export function lazyLayer<S, E, R>(
  service: Context.Service.Any,
  layer: Layer.Layer<S, E, R>,
): Layer.Layer<S, E, R> {
  return Layer.fromBuildMemo((memoMap, scope) =>
    Effect.gen(function* () {
      const build = yield* Effect.cached(
        Layer.buildWithMemoMap(layer, memoMap, scope).pipe(Effect.map((context) => Context.get(context, service))),
      )

      const invoke = (property: PropertyKey, args: unknown[]) =>
        Effect.flatMap(build, (instance) => {
          const member = (instance as Record<PropertyKey, unknown>)[property]
          const result = typeof member === "function" ? member.apply(instance, args) : member
          return Effect.isEffect(result) ? result : Effect.succeed(result)
        })

      const proxy = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "then" || typeof property === "symbol") return undefined
            return (...args: unknown[]) => invoke(property, args)
          },
        },
      )

      return Context.make(service, proxy as never) as Context.Context<S>
    }),
  )
}
