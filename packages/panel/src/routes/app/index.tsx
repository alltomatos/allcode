import { A, createAsync } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Card, EmptyState, PageHeader, StatGrid } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getStats, listAudit } from "~/lib/actions"
import { actionKey, formatDate } from "~/lib/labels"

export default function OverviewPage() {
  const i18n = useI18n()
  const stats = createAsync(() => getStats())
  const events = createAsync(() => listAudit())

  return (
    <div>
      <PageHeader title={i18n.t("overview.title")} subtitle={i18n.t("overview.subtitle")} />

      <Show when={stats()}>
        {(current) => (
          <StatGrid
            items={[
              { label: i18n.t("overview.total"), value: current().total },
              { label: i18n.t("overview.active"), value: current().active },
              { label: i18n.t("overview.invited"), value: current().invited },
              { label: i18n.t("overview.suspended"), value: current().suspended },
            ]}
          />
        )}
      </Show>

      <div class="mt-8">
        <Card>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-900">{i18n.t("overview.recent")}</h2>
            <A href="/app/auditoria" class="text-xs font-medium text-indigo-600 hover:text-indigo-500">
              {i18n.t("nav.audit")}
            </A>
          </div>

          <Show when={events()?.length} fallback={<EmptyState>{i18n.t("overview.empty")}</EmptyState>}>
            <ul class="divide-y divide-slate-100">
              <For each={events()?.slice(0, 8)}>
                {(event) => (
                  <li class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <span class="font-medium text-slate-900">
                        {i18n.t(actionKey(event.action) ?? "overview.recent")}
                      </span>
                      <span class="ml-2 text-slate-500">{event.actorEmail}</span>
                    </div>
                    <span class="text-xs text-slate-400">{formatDate(event.at, i18n.locale())}</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Card>
      </div>
    </div>
  )
}
