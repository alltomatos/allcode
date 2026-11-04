import { Show } from "solid-js"
import { Badge } from "~/components/ui"
import { formatTokens } from "~/components/session-audit"
import { formatCurrencyUsd, formatWorkingHours } from "~/lib/kpi-pricing"
import { useI18n } from "~/i18n"
import type { OrgKPIs } from "~/lib/store"

export function OverviewKpis(props: { kpis: OrgKPIs | undefined | null }) {
  const i18n = useI18n()
  const data = () => props.kpis

  return (
    <div class="mb-8">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-xs font-bold uppercase tracking-wider text-slate-500">
          {i18n.t("overview.kpi.title")}
        </h2>
        <span class="text-xs text-slate-400">
          {i18n.t("overview.kpi.subtitle")}
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Consolidado de Tokens */}
        <div class="flex flex-col justify-between rounded-xl bg-white p-5 ring-1 ring-slate-200 shadow-2xs">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">{i18n.t("overview.kpi.tokens")}</span>
              <span class="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-200/60 ring-inset">
                Tokens
              </span>
            </div>
            <div class="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatTokens(data()?.totalTokens ?? 0)}
            </div>
          </div>
          <div class="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500 truncate">
            {i18n.t("overview.kpi.tokensDetail", {
              input: formatTokens(data()?.tokensInput ?? 0),
              output: formatTokens(data()?.tokensOutput ?? 0),
            })}
          </div>
        </div>

        {/* Card 2: Horas Trabalhadas */}
        <div class="flex flex-col justify-between rounded-xl bg-white p-5 ring-1 ring-slate-200 shadow-2xs">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">{i18n.t("overview.kpi.hours")}</span>
              <span class="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/60 ring-inset">
                ⏱️ Tempo
              </span>
            </div>
            <div class="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatWorkingHours(data()?.totalDurationMs ?? 0)}
            </div>
          </div>
          <div class="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500 truncate">
            {i18n.t("overview.kpi.hoursDetail", {
              sessions: data()?.totalSessions ?? 0,
            })}
          </div>
        </div>

        {/* Card 3: Economia Comparativa */}
        <div class="flex flex-col justify-between rounded-xl bg-white p-5 ring-1 ring-slate-200 shadow-2xs">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">{i18n.t("overview.kpi.savings")}</span>
              <Show
                when={(data()?.savingsPercentage ?? 0) > 0}
                fallback={<Badge tone="neutral">0%</Badge>}
              >
                <Badge tone="success">
                  +{data()?.savingsPercentage ?? 0}%
                </Badge>
              </Show>
            </div>
            <div class="mt-2 text-3xl font-bold tracking-tight text-emerald-600">
              {formatCurrencyUsd(data()?.savingsUsd ?? 0)}
            </div>
          </div>
          <div class="mt-3 border-t border-slate-100 pt-2 text-xs font-medium text-emerald-700 truncate" title="Referência de tabela direta Anthropic Claude 3.5 Sonnet e OpenAI GPT-4o">
            {i18n.t("overview.kpi.savingsDetail")}
          </div>
        </div>

        {/* Card 4: Custo Efetivo AllCode */}
        <div class="flex flex-col justify-between rounded-xl bg-white p-5 ring-1 ring-slate-200 shadow-2xs">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-600">{i18n.t("overview.kpi.cost")}</span>
              <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 ring-inset">
                Efetivo
              </span>
            </div>
            <div class="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatCurrencyUsd(data()?.totalCostUsd ?? 0)}
            </div>
          </div>
          <div class="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500 truncate">
            {i18n.t("overview.kpi.costDetail")}
          </div>
        </div>
      </div>
    </div>
  )
}
