import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"

export const HealthGroup = HttpApiGroup.make("server.health").add(
  HttpApiEndpoint.get("health.get", "/api/health", {
    success: Schema.Struct({
      healthy: Schema.Literal(true),
      version: Schema.optional(Schema.String),
      // Anuncia paridade de provider entre as trilhas v1 e v2. O cliente só
      // prefere v2 quando este campo existe (corte por capacidade).
      providerParity: Schema.optional(Schema.Boolean),
      providerParityReason: Schema.optional(Schema.String),
    }),
  }).annotateMerge(
    OpenApi.annotations({
      identifier: "v2.health.get",
      summary: "Check server health",
      description: "Check whether the API server is ready to accept requests.",
    }),
  ),
)

