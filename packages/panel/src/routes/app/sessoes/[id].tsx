import { A, createAsync, useParams } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Badge, Card, EmptyState, PageHeader, StatGrid } from "~/components/ui"
import { formatDuration, formatTokens, modelLabel, providerLabel } from "~/components/session-audit"
import { useI18n } from "~/i18n"
import { getSessionAudit } from "~/lib/actions"
import { formatDate } from "~/lib/labels"

export default function SessionDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const data = createAsync(() => getSessionAudit(params.id!))

  return (
    <div>
      <PageHeader
        title={data()?.session.title ?? i18n.t("session.detail.title")}
        subtitle={data()?.owner ? `${data()!.owner!.name} · ${data()!.owner!.email}` : undefined}
        actions={
          <Show
            when={data()?.session.userID}
            fallback={
              <A href="/app/auditoria" class="text-sm font-medium text-slate-600 hover:text-slate-900">
                ← {i18n.t("common.back")}
              </A>
            }
          >
            {(userID) => (
              <A
                href={`/app/usuarios/${userID()}`}
                class="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                ← {i18n.t("session.detail.backToUser")}
              </A>
            )}
          </Show>
        }
      />

      <Show when={data()} fallback={<EmptyState>{i18n.t("session.detail.notFound")}</EmptyState>}>
        {(current) => {
          const session = () => current().session
          return (
            <div class="space-y-6">
              <StatGrid
                items={[
                  { label: i18n.t("user.kpis.tokens"), value: formatTokens(session().tokensTotal) },
                  { label: i18n.t("user.kpis.cost"), value: `$${session().costUsd.toFixed(4)}` },
                  { label: i18n.t("user.kpis.duration"), value: formatDuration(session().durationMs) },
                  { label: i18n.t("session.detail.messages"), value: session().messagesCount },
                ]}
              />

              <div class="grid gap-6 lg:grid-cols-3">
                <Card class="lg:col-span-2">
                  <h2 class="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
                    {i18n.t("session.detail.summary")}
                  </h2>
                  <p class="mt-4 text-sm leading-relaxed whitespace-pre-line text-slate-700">
                    {session().summary}
                  </p>
                </Card>

                <Card>
                  <h2 class="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
                    {i18n.t("session.detail.metadata")}
                  </h2>
                  <dl class="mt-4 space-y-3 text-xs">
                    <div>
                      <dt class="text-slate-500">{i18n.t("user.sessions.workspace")}</dt>
                      <dd class="mt-0.5 font-mono break-all text-slate-700">{session().workspace}</dd>
                    </div>
                    <div>
                      <dt class="text-slate-500">{i18n.t("session.detail.startedAt")}</dt>
                      <dd class="mt-0.5 text-slate-700">{formatDate(session().startedAt, i18n.locale())}</dd>
                    </div>
                    <div>
                      <dt class="text-slate-500">{i18n.t("session.detail.endedAt")}</dt>
                      <dd class="mt-0.5 text-slate-700">
                        {session().endedAt ? formatDate(session().endedAt, i18n.locale()) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-slate-500">{i18n.t("session.detail.id")}</dt>
                      <dd class="mt-0.5 font-mono break-all text-slate-500">{session().sessionID}</dd>
                    </div>
                  </dl>
                </Card>
              </div>

              <div class="grid gap-6 lg:grid-cols-2">
                <Card>
                  <h2 class="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
                    {i18n.t("session.detail.usage")}
                  </h2>
                  <dl class="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt class="text-xs text-slate-500">{i18n.t("session.detail.input")}</dt>
                      <dd class="mt-0.5 font-semibold text-slate-900">{formatTokens(session().tokensInput)}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">{i18n.t("session.detail.output")}</dt>
                      <dd class="mt-0.5 font-semibold text-slate-900">{formatTokens(session().tokensOutput)}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">{i18n.t("session.detail.reasoning")}</dt>
                      <dd class="mt-0.5 font-semibold text-slate-900">{formatTokens(session().tokensReasoning)}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">{i18n.t("session.detail.total")}</dt>
                      <dd class="mt-0.5 font-semibold text-slate-900">{formatTokens(session().tokensTotal)}</dd>
                    </div>
                  </dl>
                </Card>

                <Card>
                  <h2 class="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">
                    {i18n.t("user.models.title")}
                  </h2>
                  <Show
                    when={session().modelUsage.length > 0}
                    fallback={<p class="mt-4 text-sm text-slate-500">{i18n.t("user.models.empty")}</p>}
                  >
                    <ul class="mt-4 space-y-3">
                      <For each={session().modelUsage}>
                        {(usage) => (
                          <li class="flex flex-wrap items-center justify-between gap-2">
                            <div class="min-w-0">
                              <p class="truncate text-xs font-semibold text-slate-900">{modelLabel(usage.modelID)}</p>
                              <p class="truncate text-[11px] text-slate-500">{providerLabel(usage.providerID)}</p>
                            </div>
                            <div class="flex items-center gap-2">
                              <Badge tone="brand">{formatTokens(usage.tokens)} tokens</Badge>
                              <span class="text-[11px] text-slate-400">
                                {usage.calls} {i18n.t("user.models.calls")}
                              </span>
                            </div>
                          </li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </Card>
              </div>
            </div>
          )
        }}
      </Show>
    </div>
  )
}
