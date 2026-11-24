import { A, createAsync } from "@solidjs/router"
import { For, Show } from "solid-js"
import { Badge, Button, Card, EmptyState, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { listGlobalProviders } from "~/lib/actions"

export default function GlobalProvidersPage() {
  const i18n = useI18n()
  const providers = createAsync(() => listGlobalProviders())

  return (
    <div>
      <PageHeader
        title="Provedores Globais"
        subtitle="Catálogo registrado pelo superadmin e compartilhado com todas as empresas."
        actions={
          <A href="/4dm1n/provedores/novo">
            <Button>+ {i18n.t("providers.add")}</Button>
          </A>
        }
      />

      <Card>
        <Show
          when={(providers() ?? []).length > 0}
          fallback={<EmptyState>Nenhum provedor global cadastrado.</EmptyState>}
        >
          <div class="divide-y divide-slate-100">
            <For each={providers() ?? []}>
              {(provider) => {
                const activeModels = () => (provider.models ?? []).filter((model) => model.enabled !== false).length
                return (
                  <div class="flex flex-wrap items-center gap-3 py-3.5">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-sm font-semibold text-slate-900">{provider.displayName}</span>
                        <Badge tone="brand">
                          {provider.protocol === "anthropic" ? "Anthropic" : "OpenAI"}
                        </Badge>
                        <Badge tone="warning">Global</Badge>
                        <Badge tone={provider.enabled ? "success" : "warning"}>
                          {i18n.t(provider.enabled ? "providers.status.enabled" : "providers.status.disabled")}
                        </Badge>
                        <span class="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {activeModels()} modelos ativos
                        </span>
                      </div>
                      <div class="mt-1 flex items-center gap-3 font-mono text-[11px] text-slate-400">
                        <span>ID: {provider.providerID}</span>
                        <Show when={provider.baseURL}>
                          <span class="truncate font-sans text-slate-500">{provider.baseURL}</span>
                        </Show>
                      </div>
                    </div>
                    <A
                      href={`/4dm1n/provedores/${provider.id}`}
                      class="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      {i18n.t("providers.form.editTitle")}
                    </A>
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
