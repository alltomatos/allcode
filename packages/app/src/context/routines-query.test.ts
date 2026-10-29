import { describe, expect, test } from "bun:test"
import { QueryClient } from "@tanstack/solid-query"
import { invalidateRoutines, routinesQueryKey } from "./routines-query"

describe("routines query invalidation", () => {
  test("invalidates the routines list for the given server only", async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(routinesQueryKey("sidecar"), [])
    queryClient.setQueryData(routinesQueryKey("other"), [])

    await invalidateRoutines(queryClient, "sidecar")

    expect(queryClient.getQueryState(routinesQueryKey("sidecar"))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(routinesQueryKey("other"))?.isInvalidated).toBe(false)
  })

  test("leaves unrelated queries untouched", async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(["unrelated"], 1)
    queryClient.setQueryData(routinesQueryKey("sidecar"), [])

    await invalidateRoutines(queryClient, "sidecar")

    expect(queryClient.getQueryState(["unrelated"])?.isInvalidated).toBe(false)
  })
})
