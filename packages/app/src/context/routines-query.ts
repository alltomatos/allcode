import type { QueryClient } from "@tanstack/solid-query"

export const ROUTINES_QUERY_KEY = "routines-schedules"

export const routinesQueryKey = (server: string) => [ROUTINES_QUERY_KEY, server] as const

export const invalidateRoutines = (queryClient: QueryClient, server: string) =>
  queryClient.invalidateQueries({ queryKey: routinesQueryKey(server) })
