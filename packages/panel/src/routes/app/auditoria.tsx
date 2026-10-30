import { createAsync } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Badge, EmptyState, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { listAudit } from "~/lib/actions"
import { actionKey, formatDate } from "~/lib/labels"

export default function AuditPage() {
  const i18n = useI18n()
  const events = createAsync(() => listAudit())

  return (
    <div>
      <PageHeader title={i18n.t("audit.title")} subtitle={i18n.t("audit.subtitle")} />

      <Show when={events()?.length} fallback={<EmptyState>{i18n.t("audit.empty")}</EmptyState>}>
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
              <For each={events()}>
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
    </div>
  )
}
