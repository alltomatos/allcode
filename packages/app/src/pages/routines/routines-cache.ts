import { createQuery } from "@tanstack/solid-query"
import type { ScheduleInfo } from "@allcode/sdk/v2"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { useServer } from "@/context/server"
import { routinesQueryKey } from "@/context/routines-query"

export function useRoutinesQuery() {
  const server = useServer()
  const serverSDK = useServerSDK()
  const sync = useServerSync()
  // The schedule.* events are handled by the server sync's listener, so this
  // query must live in the same cache for invalidation to reach it.
  const queryClient = () => sync().queryClient

  const scheduleClient = () => (serverSDK().client as any).schedule ?? (serverSDK().client as any).v2?.schedule

  const query = createQuery<ScheduleInfo[]>(
    () => ({
      queryKey: routinesQueryKey(server.key),
      queryFn: async () => {
        const client = scheduleClient()
        if (!client) return []
        const result = await client.list()
        return (result.data ?? []) as ScheduleInfo[]
      },
      // `schedule.created/updated/deleted` invalidate this query, so the stale
      // window only covers the gap between an event loss and the next
      // mount/focus. Keep it short without polling.
      staleTime: 30 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: true,
    }),
    queryClient,
  )

  const invalidate = () => {
    void queryClient().invalidateQueries({ queryKey: routinesQueryKey(server.key) })
  }

  return {
    query,
    schedules: () => query.data ?? [],
    loading: () => query.isLoading && !query.data,
    refetch: () => query.refetch(),
    invalidate,
    scheduleClient,
  }
}
