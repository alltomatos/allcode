import { createAsync } from "@solidjs/router"
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import { Badge, EmptyState, PageHeader, StatGrid, cx } from "~/components/ui"
import { SessionAuditCard, formatDuration, formatTokens } from "~/components/session-audit"
import { useI18n } from "~/i18n"
import { getOrgKPIs, getOrgSessions, listAudit, listUsers } from "~/lib/actions"
import { actionKey, formatDate } from "~/lib/labels"
import type { AuditEvent } from "~/lib/store"

const PAGE_SIZE = 20

type Tab = "sessions" | "events"

export default function AuditPage() {
  const i18n = useI18n()
  const [tab, setTab] = createSignal<Tab>("sessions")
  const [search, setSearch] = createSignal("")
  const [userID, setUserID] = createSignal("")
  const [offset, setOffset] = createSignal(0)

  let debounce: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(debounce))

  const onSearch = (value: string) => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      setOffset(0)
      setSearch(value)
    }, 300)
  }

  const users = createAsync(() => listUsers())
  const kpis = createAsync(() => getOrgKPIs())
  const sessions = createAsync(() =>
    getOrgSessions({
      userID: userID() || undefined,
      search: search() || undefined,
      limit: PAGE_SIZE + 1,
      offset: offset(),
    }),
  )
  const events = createAsync(() => listAudit())

  const userNames = createMemo(() => {
    const map = new Map<string, string>()
    for (const user of users() ?? []) map.set(user.id, user.name)
    return map
  })

  const hasNext = createMemo(() => (sessions()?.length ?? 0) > PAGE_SIZE)
  const visibleSessions = createMemo(() => (sessions() ?? []).slice(0, PAGE_SIZE))

  return (
    <div>
      <PageHeader title={i18n.t("audit.title")} subtitle={i18n.t("audit.subtitle")} />

      <div class="mb-6 inline-flex rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("sessions")}
          class={cx(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition",
            tab() === "sessions" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {i18n.t("audit.tab.sessions")}
        </button>
        <button
          type="button"
          onClick={() => setTab("events")}
          class={cx(
            "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition",
            tab() === "events" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {i18n.t("audit.tab.events")}
        </button>
      </div>

      <Show when={tab() === "sessions"} fallback={<EventsTable events={events()} />}>
        <Show when={kpis()}>
          {(current) => (
            <StatGrid
              items={[
                { label: i18n.t("user.kpis.sessions"), value: current().totalSessions },
                { label: i18n.t("user.kpis.tokens"), value: formatTokens(current().totalTokens) },
                { label: i18n.t("user.kpis.cost"), value: `$${current().totalCostUsd.toFixed(4)}` },
                { label: i18n.t("user.kpis.duration"), value: formatDuration(current().totalDurationMs) },
              ]}
            />
          )}
        </Show>

        <div class="mt-6 mb-4 flex flex-wrap items-center gap-3">
          <input
            class="h-10 w-full max-w-sm rounded-lg bg-white px-3 text-sm ring-1 ring-slate-300 ring-inset outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
            placeholder={i18n.t("audit.sessions.search")}
            aria-label={i18n.t("common.search")}
            onInput={(event) => onSearch(event.currentTarget.value)}
          />
          <select
            class="h-10 rounded-lg bg-white px-3 text-sm text-slate-900 ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={i18n.t("audit.sessions.allUsers")}
            onChange={(event) => {
              setOffset(0)
              setUserID(event.currentTarget.value)
            }}
          >
            <option value="">{i18n.t("audit.sessions.allUsers")}</option>
            <For each={users()}>{(user) => <option value={user.id}>{user.name}</option>}</For>
          </select>
          <span class="text-xs text-slate-500">
            {visibleSessions().length} {i18n.t("audit.sessions.count")}
          </span>
        </div>

        <Show
          when={visibleSessions().length}
          fallback={<EmptyState>{i18n.t("audit.sessions.empty")}</EmptyState>}
        >
          <div class="space-y-3.5">
            <For each={visibleSessions()}>
              {(session) => (
                <SessionAuditCard
                  session={session}
                  locale={i18n.locale()}
                  owner={userNames().get(session.userID)}
                  href={`/app/sessoes/${encodeURIComponent(session.sessionID)}`}
                />
              )}
            </For>
          </div>

          <div class="mt-6 flex items-center justify-between">
            <button
              type="button"
              disabled={offset() === 0}
              onClick={() => setOffset(Math.max(0, offset() - PAGE_SIZE))}
              class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {i18n.t("audit.sessions.previous")}
            </button>
            <button
              type="button"
              disabled={!hasNext()}
              onClick={() => setOffset(offset() + PAGE_SIZE)}
              class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              {i18n.t("audit.sessions.next")}
            </button>
          </div>
        </Show>
      </Show>
    </div>
  )
}

function EventsTable(props: { events: AuditEvent[] | undefined }) {
  const i18n = useI18n()

  return (
    <Show when={props.events?.length} fallback={<EmptyState>{i18n.t("audit.empty")}</EmptyState>}>
      <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <table class="w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
            <tr>
              <th class="px-4 py-3">{i18n.t("audit.action")}</th>
              <th class="px-4 py-3">{i18n.t("audit.actor")}</th>
              <th class="hidden px-4 py-3 sm:table-cell">{i18n.t("audit.target")}</th>
              <th class="px-4 py-3">{i18n.t("audit.result")}</th>
              <th class="hidden px-4 py-3 lg:table-cell">{i18n.t("common.createdAt")}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <For each={props.events}>
              {(event) => (
                <tr class="hover:bg-slate-50">
                  <td class="px-4 py-3 font-medium text-slate-900">
                    {i18n.t(actionKey(event.action) ?? "audit.action")}
                  </td>
                  <td class="px-4 py-3 text-slate-600">{event.actorEmail}</td>
                  <td class="hidden px-4 py-3 font-mono text-xs text-slate-500 sm:table-cell">
                    {event.targetID ? event.targetID.slice(0, 8) : "—"}
                  </td>
                  <td class="px-4 py-3">
                    <Badge tone={event.result === "allow" ? "success" : "danger"}>
                      {i18n.t(event.result === "allow" ? "audit.result.allow" : "audit.result.deny")}
                    </Badge>
                  </td>
                  <td class="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                    {formatDate(event.at, i18n.locale())}
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </Show>
  )
}
