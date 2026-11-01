import { A, createAsync } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Card, EmptyState, PageHeader, StatGrid } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getCurrentOrg, getStats, listAudit } from "~/lib/actions"
import { getTrialDaysRemaining } from "~/lib/store"
import { actionKey, formatDate } from "~/lib/labels"

export default function OverviewPage() {
  const i18n = useI18n()
  const stats = createAsync(() => getStats())
  const events = createAsync(() => listAudit())
  const org = createAsync(() => getCurrentOrg())

  return (
    <div>
      <PageHeader
        title={org()?.name ? `Painel • ${org()!.name}` : i18n.t("overview.title")}
        subtitle={i18n.t("overview.subtitle")}
      />

      <Show when={org()?.welcomeMessage}>
        <div class="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 p-5 shadow-xs">
          <div class="flex items-start gap-3">
            <span class="text-2xl">👋</span>
            <div>
              <h3 class="text-sm font-bold text-slate-900">Mensagem de Boas-Vindas</h3>
              <p class="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{org()!.welcomeMessage}</p>
            </div>
          </div>
        </div>
      </Show>

      <Show when={org()?.planType === "trial"}>
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">⏱️</span>
            <div>
              <div class="text-xs font-bold uppercase tracking-wide">Ambiente em Período de Avaliação (Trial)</div>
              <div class="text-xs text-amber-800">
                Sua empresa possui <strong>{getTrialDaysRemaining(org()!) ?? 0} dia(s)</strong> restante(s) de teste gratuito de todos os recursos.
              </div>
            </div>
          </div>
          <A
            href="/app/configuracoes"
            class="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition"
          >
            Falar com Suporte / Ativar Plano
          </A>
        </div>
      </Show>

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
