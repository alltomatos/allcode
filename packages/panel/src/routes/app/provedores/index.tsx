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
              <Button>{i18n.t("providers.add")}</Button>
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
              {(provider) => (
                <div class="flex flex-wrap items-center gap-3 py-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="truncate text-sm font-medium text-slate-900">{provider.displayName}</span>
                      <Badge tone={provider.kind === "proxy" ? "brand" : provider.kind === "custom" ? "brand" : "neutral"}>
                        {i18n.t(
                          provider.kind === "proxy"
                            ? "providers.kind.proxy"
                            : provider.kind === "custom"
                              ? "providers.kind.custom"
                              : "providers.kind.builtin",
                        )}
                      </Badge>
                      <Badge tone={provider.enabled ? "success" : "warning"}>
                        {i18n.t(provider.enabled ? "providers.status.enabled" : "providers.status.disabled")}
                      </Badge>
                    </div>
                    <div class="mt-1 font-mono text-[11px] text-slate-400">
                      {provider.providerID}
                      <Show when={provider.baseURL}>
                        <span class="ml-2 font-sans">{provider.baseURL}</span>
                      </Show>
                    </div>
                  </div>
                  <span class="text-xs text-slate-500">
                    {usageFor(provider.providerID)} {i18n.t("providers.users")}
                  </span>
                  <A href={`/app/provedores/${provider.id}`} class="text-xs font-medium text-indigo-600 hover:text-indigo-500">
                    {i18n.t("providers.form.editTitle")}
                  </A>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Card>
    </div>
  )
}
