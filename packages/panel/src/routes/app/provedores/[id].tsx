import { A, createAsync, revalidate, useAction, useNavigate, useParams } from "@solidjs/router"
import { Show, createSignal } from "solid-js"
import { ProviderForm, type ProviderFormValue } from "~/components/provider-form"
import { Badge, Button, Card, EmptyState, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getProvider, removeProvider, requireMe, updateProvider } from "~/lib/actions"

export default function ProviderDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const navigate = useNavigate()
  const actor = createAsync(() => requireMe())
  const provider = createAsync(() => getProvider(params.id!))
  const save = useAction(updateProvider)
  const remove = useAction(removeProvider)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)
  const [saved, setSaved] = createSignal(false)

  const isOwner = () => actor()?.role === "owner"

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
    revalidate("panel.provider")
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
    revalidate("panel.providers")
    navigate("/app/provedores")
  }

  return (
    <div class="max-w-3xl space-y-6">
      <PageHeader
        title={provider()?.displayName ?? i18n.t("providers.form.editTitle")}
        subtitle={provider()?.providerID}
        actions={
          <A href="/app/provedores" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Show when={provider()} fallback={<EmptyState>{i18n.t("providers.empty")}</EmptyState>}>
        {(current) => (
          <div class="space-y-6">
            <div class="flex items-center gap-2">
              <Badge tone="brand">
                {current().protocol === "anthropic" ? "Anthropic Protocol" : "OpenAI Protocol"}
              </Badge>
              <Badge tone={current().enabled ? "success" : "warning"}>
                {i18n.t(current().enabled ? "providers.status.enabled" : "providers.status.disabled")}
              </Badge>
              <span class="text-xs text-slate-500 font-mono">
                {current().baseURL}
              </span>
            </div>

            <Show
              when={actor()?.role === "owner" || actor()?.role === "admin"}
              fallback={
                <Card>
                  <p class="text-sm text-slate-500">{i18n.t("users.new.error.forbidden")}</p>
                </Card>
              }
            >
              <ProviderForm
                provider={current()}
                error={error()}
                pending={pending()}
                onSubmit={onSubmit}
              />

              <Show when={saved()}>
                <div class="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                  {i18n.t("providers.saved")}
                </div>
              </Show>

              <Show when={isOwner()}>
                <Card class="border-rose-200">
                  <div class="flex items-center justify-between">
                    <div>
                      <h4 class="text-sm font-semibold text-rose-900">Remover Provedor</h4>
                      <p class="text-xs text-slate-500">
                        Exclui este provedor do catálogo da organização e revoga todas as permissões concedidas.
                      </p>
                    </div>
                    <Button variant="danger" size="sm" disabled={pending()} onClick={onRemove}>
                      {i18n.t("providers.form.remove")}
                    </Button>
                  </div>
                </Card>
              </Show>
            </Show>
          </div>
        )}
      </Show>
    </div>
  )
}
