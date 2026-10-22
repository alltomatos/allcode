import { describe, expect } from "bun:test"
import { LayerNode } from "@allcode/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { ExperimentalPaths } from "../../src/server/routes/instance/httpapi/groups/experimental"
import { Session } from "@/session/session"
import { Database } from "@allcode/core/database/database"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { httpApiLayer, requestInDirectory } from "./httpapi-layer"

const it = testEffect(Layer.mergeAll(LayerNode.compile(LayerNode.group([Session.node, Database.node])), httpApiLayer))

describe("experimental.enhancePrompt HttpApi", () => {
  it.instance("returns 400 when prompt is empty", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const response = yield* requestInDirectory(ExperimentalPaths.enhancePrompt, test.directory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "   " }),
      })
      expect(response.status).toBe(400)
    }),
  )

  it.instance("returns 400 with helpful message when model cannot be resolved", () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const response = yield* requestInDirectory(ExperimentalPaths.enhancePrompt, test.directory, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "Refatore esta funcao", model: "nonexistent/fake-model" }),
      })
      expect(response.status).toBe(400)
      const data = yield* response.json
      expect(data).toMatchObject({
        _tag: "InvalidRequestError",
      })
    }),
  )
})
