import { For, Show } from "solid-js"
import { Badge, Card, EmptyState, StatGrid } from "~/components/ui"
import { SessionAuditCard, formatDuration, formatTokens, modelLabel, providerLabel } from "~/components/session-audit"
import { useI18n } from "~/i18n"
import type { UserDetail } from "~/lib/actions"
import { actionKey, formatDate, roleKey, roleTone, statusKey, statusTone } from "~/lib/labels"
import type { AuditEvent, ModelUsageSummary, SessionAudit, UserKPIs } from "~/lib/store"

export function UserOverview(props: {
  user: UserDetail
  kpis: UserKPIs | undefined
  sessions: SessionAudit[] | undefined
  modelUsage: ModelUsageSummary[] | undefined
  history: AuditEvent[] | undefined
  modelDays: number
  onModelDays: (days: number) => void
}) {
  const i18n = useI18n()

  const totalModelTokens = () => (props.modelUsage ?? []).reduce((total, item) => total + item.tokens, 0)
  const maxModelTokens = () => (props.modelUsage ?? []).reduce((max, item) => Math.max(max, item.tokens), 0)

  return (
    <div class="space-y-6">
      <Show when={props.kpis}>
        {(metrics) => (
          <StatGrid
            items={[
              { label: i18n.t("user.kpis.sessions"), value: metrics().totalSessions },
              { label: i18n.t("user.kpis.tokens"), value: formatTokens(metrics().totalTokens) },
              { label: i18n.t("user.kpis.cost"), value: `$${metrics().totalCostUsd.toFixed(4)}` },
              { label: i18n.t("user.kpis.duration"), value: formatDuration(metrics().totalDurationMs) },
            ]}
          />
        )}
      </Show>

      <div class="grid gap-6 lg:grid-cols-3">
        <Card class="lg:col-span-2">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.detail.profile")}</h2>
            <div class="flex items-center gap-2">
              <Show when={props.user.auditExempt}>
                <Badge tone="brand">{i18n.t("user.badge.auditExempt")}</Badge>
              </Show>
              <Badge tone={roleTone(props.user.role)}>{i18n.t(roleKey(props.user.role))}</Badge>
              <Badge tone={statusTone(props.user.status)}>{i18n.t(statusKey(props.user.status))}</Badge>
            </div>
          </div>

          <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-xs text-slate-500">{i18n.t("common.name")}</dt>
              <dd class="mt-0.5 font-medium text-slate-900">{props.user.name}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">{i18n.t("common.email")}</dt>
              <dd class="mt-0.5 font-mono text-xs text-slate-900">{props.user.email}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">{i18n.t("common.createdAt")}</dt>
              <dd class="mt-0.5 text-slate-700">{formatDate(props.user.createdAt, i18n.locale())}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">{i18n.t("common.lastLogin")}</dt>
              <dd class="mt-0.5 text-slate-700">
                {props.user.lastLoginAt ? formatDate(props.user.lastLoginAt, i18n.locale()) : i18n.t("common.never")}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">{i18n.t("user.detail.appVersion")}</dt>
              <dd class="mt-0.5">
                <Show when={props.user.appVersion} fallback={<span class="text-slate-400">—</span>}>
                  <span class="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                    v{props.user.appVersion}
                  </span>
                  <Show when={props.user.appVersionAt}>
                    <span class="ml-2 text-[11px] text-slate-400">
                      {formatDate(props.user.appVersionAt, i18n.locale())}
                    </span>
                  </Show>
                </Show>
              </dd>
            </div>
          </dl>

          <Show when={props.user.mustChangePassword}>
            <div class="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              {i18n.t("user.detail.mustChange")}
            </div>
          </Show>
        </Card>

        <Card>
          <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.models.title")}</h2>
              <p class="mt-0.5 text-[11px] text-slate-500">{i18n.t("user.models.subtitle")}</p>
            </div>
            <select
              class="h-8 shrink-0 rounded-lg bg-white px-2 text-xs text-slate-700 ring-1 ring-slate-300 ring-inset outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label={i18n.t("user.models.period")}
              value={String(props.modelDays)}
              onChange={(event) => props.onModelDays(Number(event.currentTarget.value))}
            >
              <option value="0">{i18n.t("user.models.period.all")}</option>
              <option value="30">{i18n.t("user.models.period.30d")}</option>
              <option value="90">{i18n.t("user.models.period.90d")}</option>
            </select>
          </div>

          <Show
            when={(props.modelUsage ?? []).length > 0}
            fallback={
              <div class="mt-4">
                <EmptyState>{i18n.t("user.models.empty")}</EmptyState>
              </div>
            }
          >
            <ul class="mt-4 space-y-3">
              <For each={props.modelUsage}>
                {(usage) => (
                  <li>
                    <div class="flex items-baseline justify-between gap-2">
                      <div class="min-w-0">
                        <p class="truncate text-xs font-semibold text-slate-900" title={usage.modelID}>
                          {modelLabel(usage.modelID)}
                        </p>
                        <p class="truncate text-[11px] text-slate-500">{providerLabel(usage.providerID)}</p>
                      </div>
                      <span class="shrink-0 text-[11px] font-medium text-slate-700">
                        {formatTokens(usage.tokens)}
                      </span>
                    </div>
                    <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        class="h-full rounded-full bg-indigo-500"
                        style={{
                          width: `${maxModelTokens() > 0 ? Math.max(4, (usage.tokens / maxModelTokens()) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div class="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>
                        {usage.calls} {i18n.t("user.models.calls")} · {usage.sessions} {i18n.t("user.models.sessions")}
                      </span>
                      <span>
                        {totalModelTokens() > 0 ? Math.round((usage.tokens / totalModelTokens()) * 100) : 0}%
                      </span>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Card>
      </div>

      <Card>
        <div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-900">{i18n.t("user.sessions.title")}</h2>
            <span class="text-xs text-slate-500">{i18n.t("user.sessions.subtitle")}</span>
          </div>
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {props.sessions?.length ?? 0} {i18n.t("audit.sessions.count")}
          </span>
        </div>

        <Show
          when={props.sessions?.length}
          fallback={<EmptyState>{i18n.t("user.detail.noSessions")}</EmptyState>}
        >
          <div class="grid gap-3.5 xl:grid-cols-2">
            <For each={props.sessions}>
              {(session) => (
                <SessionAuditCard
                  session={session}
                  locale={i18n.locale()}
                  href={`/app/sessoes/${encodeURIComponent(session.sessionID)}`}
                />
              )}
            </For>
          </div>
        </Show>
      </Card>

      <Card>
        <h2 class="mb-3 text-sm font-semibold text-slate-900">{i18n.t("user.detail.audit")}</h2>
        <Show
          when={props.history?.length}
          fallback={<p class="text-sm text-slate-500">{i18n.t("audit.empty")}</p>}
        >
          <ul class="divide-y divide-slate-100">
            <For each={props.history}>
              {(event) => (
                <li class="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <span class="font-medium text-slate-900">
                    {i18n.t(actionKey(event.action) ?? "audit.action")}
                  </span>
                  <span class="text-slate-400">{formatDate(event.at, i18n.locale())}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Card>
    </div>
  )
}
