import { A, createAsync } from "@solidjs/router"
import { For, Show, createMemo, createSignal } from "solid-js"
import { Badge, EmptyState, PageHeader, StatGrid, buttonClass } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getPlatformStats, listTenants } from "~/lib/actions"
import { getEffectiveOrgStatus, getTrialDaysRemaining } from "~/lib/store"
import { formatBRL, formatDate } from "~/lib/labels"

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
        title="Gestão de Empresas"
        subtitle="Controle todas as empresas clientes, personalizações, ciclos de trial e licenças."
        actions={
          <div class="flex items-center gap-2">
            <A href="/4dm1n/planos" class={buttonClass("secondary", "md")}>
              💰 Planos e Preços
            </A>
            <A href="/4dm1n/revendedores" class={buttonClass("secondary", "md")}>
              🤝 Revendedores
            </A>
            <A href="/4dm1n/novo" class={buttonClass("primary", "md")}>
              + Nova Empresa
            </A>
          </div>
        }
      />

      <Show when={stats()}>
        {(current) => (
          <div class="mb-8">
            <StatGrid
              items={[
                { label: "Total de Empresas", value: current().totalTenants },
                { label: "Empresas Ativas", value: current().activeTenants },
                { label: "Em Período de Trial", value: current().trialTenants },
                { label: "Expiradas / Suspensas", value: current().expiredTenants },
                { label: "Total de Colaboradores", value: current().totalUsersAcrossTenants },
                {
                  label: "Receita Mensal Estimada",
                  value: formatBRL(current().estimatedMonthlyRevenue),
                },
              ]}
            />
          </div>
        )}
      </Show>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          class="h-10 w-full max-w-sm rounded-lg bg-white px-3 text-sm ring-1 ring-slate-300 ring-inset outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"
          placeholder="Buscar empresa por nome ou identificador..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
        <span class="text-xs text-slate-500 font-medium">
          {filtered().length} empresa(s)
        </span>
      </div>

      <Show when={filtered().length > 0} fallback={<EmptyState>Nenhuma empresa cadastrada.</EmptyState>}>
        <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th class="px-4 py-3">Empresa</th>
                <th class="hidden px-4 py-3 sm:table-cell">Slug</th>
                <th class="px-4 py-3">Licenças</th>
                <th class="px-4 py-3">Plano / Status</th>
                <th class="hidden px-4 py-3 lg:table-cell">{i18n.t("admin.tenants.col.created")}</th>
                <th class="px-4 py-3" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <For each={filtered()}>
                {(tenant) => {
                  const effective = () => getEffectiveOrgStatus(tenant)
                  const daysLeft = () => getTrialDaysRemaining(tenant)
                  return (
                    <tr class="hover:bg-slate-50 transition">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <Show
                            when={tenant.logoUrl}
                            fallback={
                              <div class="size-8 rounded-lg bg-slate-900 text-white font-bold text-xs grid place-items-center">
                                {tenant.name.slice(0, 1).toUpperCase()}
                              </div>
                            }
                          >
                            <div class="size-8 rounded-lg border border-slate-100 p-0.5 bg-white flex items-center justify-center">
                              <img src={tenant.logoUrl} alt="Logo" class="max-h-full max-w-full object-contain" />
                            </div>
                          </Show>
                          <div>
                            <div class="font-semibold text-slate-900">{tenant.name}</div>
                            <div class="text-xs text-slate-500">{tenant.contactEmail ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td class="hidden px-4 py-3 sm:table-cell font-mono text-xs text-slate-600">
                        {tenant.slug}
                      </td>
                      <td class="px-4 py-3 text-xs text-slate-700 font-medium">
                        {tenant.maxUsers} assentos
                      </td>
                      <td class="px-4 py-3">
                        <Badge tone={effective() === "active" ? "success" : effective() === "trial" ? "brand" : "danger"}>
                          {effective() === "active"
                            ? "Ativo (Pago)"
                            : effective() === "trial"
                              ? `Trial (${daysLeft() ?? 0}d)`
                              : effective() === "expired"
                                ? "Trial Expirado"
                                : "Suspenso"}
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
                  )
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  )
}
