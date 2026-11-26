import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstallationVersion } from "@allcode/core/installation/version"
import { Api } from "../api"

export const HealthHandler = HttpApiBuilder.group(Api, "server.health", (handlers) =>
  handlers.handle("health.get", () => {
    const requested = process.env.OPENCODE_PROVIDER_PARITY === "1"
    const parity = requested && process.env.OPENCODE_PROVIDER_PARITY_ACK === "1"
    return Effect.succeed({
      healthy: true as const,
      version: InstallationVersion,
      // Parity is only announced after an explicit acknowledgement because
      // custom providers and combos are not in the v2 catalog yet. The flag
      // alone must never flip every client to v2 by accident.
      providerParity: parity ? true : undefined,
      providerParityReason:
        requested && !parity
          ? "OPENCODE_PROVIDER_PARITY_ACK=1 is required: custom providers and combos are not yet in the v2 catalog."
          : undefined,
    })
  }),
)
