export * as EventV2 from "./event"
export * as Bus from "./event/bus"
export * as Log from "./event/log"

import { Context, Effect, Layer, Queue, Schema, Stream } from "effect"
import { Event } from "@allcode/schema/event"
import type { Payload } from "@allcode/schema/event"
import { Database } from "./database/database"
import { EventBus } from "./event/bus"
import { EventLog } from "./event/log"
import type { Interface, LayerOptions } from "./event/log"
import { makeGlobalNode, makeLocationNode } from "./effect/app-node"

export const ID = Event.ID
export type ID = import("@allcode/schema/event").ID
export type { Data, Definition, Payload } from "@allcode/schema/event"
export type { Subscriber, Unsubscribe } from "./event/bus"
export type { Interface, PublishOptions, SerializedEvent, LayerOptions } from "./event/log"
export { InvalidDurableEventError, latestSequence, readAggregate } from "./event/log"

export class SubscriberOverflowError extends Schema.TaggedErrorClass<SubscriberOverflowError>()(
  "EventV2.SubscriberOverflow",
  {},
) {}

export const define = Event.define
export const versionedType = Event.versionedType

export class Service extends Context.Service<Service, Interface>()("@opencode/Event") {}

export const allBounded = (events: { readonly listen: Interface["listen"] }, capacity: number) =>
  Effect.gen(function* () {
    const queue = yield* Queue.dropping<Payload, SubscriberOverflowError>(capacity)
    const unsubscribe = yield* events.listen((event) =>
      Effect.gen(function* () {
        const enqueued = yield* Queue.offer(queue, event)
        if (!enqueued) yield* Queue.fail(queue, new SubscriberOverflowError())
      }),
    )
    yield* Effect.addFinalizer(() => unsubscribe)
    return Stream.fromQueue(queue)
  })

export const layerWith = (options?: LayerOptions) =>
  Layer.effect(
    Service,
    EventLog.make(options).pipe(Effect.map((service) => Service.of(service))),
  )

const layer = layerWith()
export const node = makeGlobalNode({ service: Service, layer, deps: [Database.node, EventBus.node] })

export const locationNode = makeLocationNode({ service: Service, layer, deps: [Database.node, EventBus.node] })
