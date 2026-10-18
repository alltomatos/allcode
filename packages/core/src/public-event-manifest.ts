export * as PublicEventManifest from "./public-event-manifest"

import { Event } from "@allcode/schema/event"
import { EventManifest } from "@allcode/schema/event-manifest"

export const Definitions = EventManifest.ServerDefinitions
export const Latest = Event.latest(Definitions)
