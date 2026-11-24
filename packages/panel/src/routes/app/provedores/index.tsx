import { A, createAsync } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Badge, Button, Card, EmptyState, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getProviderUsage, listProviders, requireMe } from "~/lib/actions"

export default function ProvidersPage() {
  const i18n = useI18n()
  const actor = createAsync(() => requireMe())
  const providers = createAsync(() => listProviders())
  const usage = createAsync(() => getProviderUsage())
  const canManage = () => actor()?.role === "owner" || actor()?.role === "admin"

  const usageFor = (providerID: string) =>
    usage()?.find((entry) => entry.providerID === providerID)?.count ?? 0

  return (
    <div>
      <PageHeader
        title={i18n.t("providers.title")}
        subtitle={i18n.t("providers.subtitle")}
        actions={
          <Show when={canManage()}>
            <A href="/app/provedores/novo">
              <Button>+ {i18n.t("providers.add")}</Button>
            </A>
          </Show>
        }
      />

      <Card>
        <Show
          when={(providers() ?? []).length > 0}
          fallback={<EmptyState>{i18n.t("providers.empty")}</EmptyState>}
        >
          <div class="divide-y divide-slate-100">
            <For each={providers() ?? []}>
              {(provider) => {
                const activeModelsCount = () =>
                  (provider.models ?? []).filter((m) => m.enabled !== false).length

                return (
                  <div class="flex flex-wrap items-center gap-3 py-3.5">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-sm font-semibold text-slate-900">
                          {provider.displayName}
                        </span>
                        <Badge tone="brand">
                          {provider.protocol === "anthropic" ? "Anthropic" : "OpenAI"}
                        </Badge>
                        <Show when={provider.scope === "global"}>
                          <Badge tone="warning">Global</Badge>
                        </Show>
                        <Badge tone={provider.enabled ? "success" : "warning"}>
                          {i18n.t(provider.enabled ? "providers.status.enabled" : "providers.status.disabled")}
                        </Badge>
                        <span class="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {activeModelsCount()} modelos ativos
                        </span>
                      </div>
                      <div class="mt-1 font-mono text-[11px] text-slate-400 flex items-center gap-3">
                        <span>ID: {provider.providerID}</span>
                        <Show when={provider.baseURL}>
                          <span class="font-sans text-slate-500 truncate">{provider.baseURL}</span>
                        </Show>
                      </div>
                    </div>
                    <span class="text-xs text-slate-500">
                      {usageFor(provider.providerID)} {i18n.t("providers.users")}
                    </span>
                    <Show when={provider.scope !== "global"}>
                      <A
                        href={`/app/provedores/${provider.id}`}
                        class="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        {i18n.t("providers.form.editTitle")}
                      </A>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </Card>
    </div>
  )
}
