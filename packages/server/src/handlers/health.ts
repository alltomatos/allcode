import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstallationVersion } from "@allcode/core/installation/version"
import { Api } from "../api"

export const HealthHandler = HttpApiBuilder.group(Api, "server.health", (handlers) =>
  handlers.handle("health.get", () =>
    Effect.succeed({
      healthy: true as const,
      version: InstallationVersion,
      // Ligado só quando a paridade foi comprovada (flag de operador), para
      // não trocar a trilha de todos os clientes num deploy.
      providerParity: process.env.OPENCODE_PROVIDER_PARITY === "1" ? true : undefined,
    }),
  ),
)

