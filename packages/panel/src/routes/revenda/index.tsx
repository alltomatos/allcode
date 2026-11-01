import { A, createAsync } from "@solidjs/router"
import { For, Show, createMemo, createSignal } from "solid-js"
import { Badge, EmptyState, PageHeader, StatGrid, buttonClass } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getResellerDashboard } from "~/lib/actions"
import { getEffectiveOrgStatus, getTrialDaysRemaining } from "~/lib/store"
import { formatDate } from "~/lib/labels"

export default function ResellerDashboardPage() {
  const i18n = useI18n()
  const data = createAsync(() => getResellerDashboard())
  const [search, setSearch] = createSignal("")

  const filtered = createMemo(() => {
    const list = data()?.tenants ?? []
    const term = search().trim().toLowerCase()
    if (!term) return list
    return list.filter((t) => t.name.toLowerCase().includes(term) || t.slug.toLowerCase().includes(term))
  })

  function formatBRL(amount: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
  }

  return (
    <div>
      <PageHeader
        title="Painel de Revenda"
        subtitle="Gerencie suas empresas clientes, acompanhe licenças ativas, períodos de teste e comissões."
        actions={
          <A href="/revenda/novo" class={buttonClass("primary", "md")}>
            + Nova Empresa Cliente
          </A>
        }
      />

      <Show when={data()?.stats}>
        {(stats) => (
          <div class="mb-8 space-y-4">
            <StatGrid
              items={[
                { label: "Empresas Ativas", value: stats().activeTenants },
                { label: "Empresas em Trial", value: stats().trialTenants },
                { label: "Trials Expirados / Bloqueados", value: stats().expiredTenants },
                { label: "Total de Colaboradores", value: stats().totalUsers },
              ]}
            />

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div class="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Volume Mensal das Empresas (MRR)
                </div>
                <div class="mt-1 text-2xl font-bold text-slate-900">
                  {formatBRL(stats().estimatedMonthlyRevenue)}
                </div>
                <p class="mt-1 text-xs text-slate-400">
                  Calculado com base nas licenças ativas dos seus clientes corporativos.
                </p>
              </div>

              <div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-2xs">
                <div class="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Sua Comissão Estimada / Mês ({(stats().commissionRate * 100).toFixed(0)}%)
                </div>
                <div class="mt-1 text-2xl font-bold text-emerald-950">
                  {formatBRL(stats().estimatedCommission)}
                </div>
                <p class="mt-1 text-xs text-emerald-700">
                  Repasse recorrente garantido sobre todas as contas ativas gerenciadas por sua revenda.
                </p>
              </div>
            </div>
          </div>
        )}
      </Show>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3" id="empresas">
        <input
          class="h-10 w-full max-w-sm rounded-lg bg-white px-3 text-sm ring-1 ring-slate-300 ring-inset outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500"
          placeholder="Buscar empresa por nome ou slug..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
        <span class="text-xs text-slate-500 font-medium">
          {filtered().length} empresa(s)
        </span>
      </div>

      <Show when={filtered().length > 0} fallback={<EmptyState>Nenhuma empresa cliente cadastrada nesta revenda.</EmptyState>}>
        <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th class="px-4 py-3">Empresa</th>
                <th class="hidden px-4 py-3 sm:table-cell">Slug</th>
                <th class="px-4 py-3">Licenças</th>
                <th class="px-4 py-3">Status / Período</th>
                <th class="hidden px-4 py-3 lg:table-cell">Cadastrado em</th>
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
                              <div class="size-8 rounded-lg bg-emerald-900 text-white font-bold text-xs grid place-items-center">
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
                            ? "Plano Pago Ativo"
                            : effective() === "trial"
                              ? `Trial (${daysLeft() ?? 0}d restantes)`
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
                          href={`/revenda/${tenant.id}`}
                          class="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                        >
                          Gerenciar →
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
