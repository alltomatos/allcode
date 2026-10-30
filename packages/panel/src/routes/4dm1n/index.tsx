import { A, createAsync } from "@solidjs/router"
import { For, Show, createMemo, createSignal } from "solid-js"
import { Badge, EmptyState, PageHeader, StatGrid, buttonClass } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getPlatformStats, listTenants } from "~/lib/actions"
import { formatDate } from "~/lib/labels"

export default function PlatformTenantsPage() {
  const i18n = useI18n()
  const [search, setSearch] = createSignal("")
  const stats = createAsync(() => getPlatformStats())
  const tenants = createAsync(() => listTenants())

  const filtered = createMemo(() => {
    const term = search().trim().toLowerCase()
    const list = tenants() ?? []
    if (!term) return list
    return list.filter((t) => t.name.toLowerCase().includes(term) || t.slug.toLowerCase().includes(term))
  })

  return (
    <div>
      <PageHeader
        title={i18n.t("admin.tenants.title")}
        subtitle={i18n.t("admin.tenants.subtitle")}
        actions={
          <A href="/4dm1n/novo" class={buttonClass("primary", "md")}>
            + {i18n.t("admin.tenants.new")}
          </A>
        }
      />

      <Show when={stats()}>
        {(current) => (
          <div class="mb-8">
            <StatGrid
              items={[
                { label: i18n.t("admin.stats.tenantsTotal"), value: current().totalTenants },
                { label: i18n.t("admin.stats.tenantsActive"), value: current().activeTenants },
                { label: i18n.t("admin.stats.tenantsSuspended"), value: current().suspendedTenants },
                { label: i18n.t("admin.stats.usersTotal"), value: current().totalUsersAcrossTenants },
              ]}
            />
          </div>
        )}
      </Show>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          class="h-10 w-full max-w-sm rounded-lg bg-white px-3 text-sm ring-1 ring-slate-300 ring-inset outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
          placeholder={i18n.t("admin.tenants.searchPlaceholder")}
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
        <span class="text-xs text-slate-500 font-medium">
          {filtered().length} {i18n.t("admin.tenants.col.company").toLowerCase()}(s)
        </span>
      </div>

      <Show when={filtered().length > 0} fallback={<EmptyState>{i18n.t("admin.tenants.empty")}</EmptyState>}>
        <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th class="px-4 py-3">{i18n.t("admin.tenants.col.company")}</th>
                <th class="hidden px-4 py-3 sm:table-cell">{i18n.t("admin.tenants.col.slug")}</th>
                <th class="px-4 py-3">{i18n.t("admin.tenants.col.plan")}</th>
                <th class="px-4 py-3">{i18n.t("admin.tenants.col.status")}</th>
                <th class="hidden px-4 py-3 lg:table-cell">{i18n.t("admin.tenants.col.created")}</th>
                <th class="px-4 py-3" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <For each={filtered()}>
                {(tenant) => (
                  <tr class="hover:bg-slate-50 transition">
                    <td class="px-4 py-3">
                      <div class="font-semibold text-slate-900">{tenant.name}</div>
                      <div class="text-xs text-slate-500">{tenant.contactEmail ?? "—"}</div>
                    </td>
                    <td class="hidden px-4 py-3 sm:table-cell font-mono text-xs text-slate-600">
                      {tenant.slug}
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-700 font-medium">
                      {tenant.maxUsers} assentos
                    </td>
                    <td class="px-4 py-3">
                      <Badge tone={tenant.status === "active" ? "success" : "danger"}>
                        {i18n.t(tenant.status === "active" ? "admin.tenants.status.active" : "admin.tenants.status.suspended")}
                      </Badge>
                    </td>
                    <td class="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                      {formatDate(tenant.createdAt, i18n.locale())}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <A
                        href={`/4dm1n/${tenant.id}`}
                        class="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        {i18n.t("common.actions")} →
                      </A>
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
