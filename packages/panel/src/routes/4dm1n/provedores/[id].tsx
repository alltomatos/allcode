import { A, createAsync, revalidate, useAction, useNavigate, useParams } from "@solidjs/router"
import { Show, createSignal } from "solid-js"
import { ProviderForm, type ProviderFormValue } from "~/components/provider-form"
import { Badge, Button, Card, EmptyState, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getGlobalProvider, removeGlobalProvider, updateGlobalProvider } from "~/lib/actions"

export default function GlobalProviderDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const navigate = useNavigate()
  const provider = createAsync(() => getGlobalProvider(params.id!))
  const save = useAction(updateGlobalProvider)
  const remove = useAction(removeGlobalProvider)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)
  const [saved, setSaved] = createSignal(false)

  async function onSubmit(value: ProviderFormValue) {
    const current = provider()
    if (!current) return
    setPending(true)
    setError(null)
    setSaved(false)
    const result = await save(current.id, value)
    setPending(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    setSaved(true)
    revalidate("panel.admin.provider")
    revalidate("panel.admin.providers")
    revalidate("panel.providers")
  }

  async function onRemove() {
    const current = provider()
    if (!current || !window.confirm(i18n.t("providers.form.removeConfirm"))) return
    setPending(true)
    const result = await remove(current.id)
    setPending(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    revalidate("panel.admin.providers")
    revalidate("panel.providers")
    navigate("/4dm1n/provedores")
  }

  return (
    <div class="max-w-3xl space-y-6">
      <PageHeader
        title={provider()?.displayName ?? i18n.t("providers.form.editTitle")}
        subtitle={provider()?.providerID}
        actions={
          <A href="/4dm1n/provedores" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Show when={provider()} fallback={<EmptyState>Provedor global não encontrado.</EmptyState>}>
        {(current) => (
          <div class="space-y-6">
            <div class="flex items-center gap-2">
              <Badge tone="brand">
                {current().protocol === "anthropic" ? "Anthropic Protocol" : "OpenAI Protocol"}
              </Badge>
              <Badge tone="warning">Global</Badge>
              <Badge tone={current().enabled ? "success" : "warning"}>
                {i18n.t(current().enabled ? "providers.status.enabled" : "providers.status.disabled")}
              </Badge>
              <span class="font-mono text-xs text-slate-500">{current().baseURL}</span>
            </div>

            <ProviderForm provider={current()} error={error()} pending={pending()} onSubmit={onSubmit} />

            <Show when={saved()}>
              <div class="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                {i18n.t("providers.saved")}
              </div>
            </Show>

            <Card class="border-rose-200">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="text-sm font-semibold text-rose-900">Remover Provedor Global</h4>
                  <p class="text-xs text-slate-500">
                    Remove o provedor do catálogo global e revoga as permissões em todas as empresas.
                  </p>
                </div>
                <Button variant="danger" size="sm" disabled={pending()} onClick={onRemove}>
                  {i18n.t("providers.form.remove")}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </Show>
    </div>
  )
}
