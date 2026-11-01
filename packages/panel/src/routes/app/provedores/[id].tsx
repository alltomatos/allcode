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
    <div>
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
          <Card class="max-w-2xl">
            <div class="mb-4 flex items-center gap-2">
              <Badge tone={current().kind === "proxy" ? "brand" : current().kind === "custom" ? "brand" : "neutral"}>
                {i18n.t(
                  current().kind === "proxy"
                    ? "providers.kind.proxy"
                    : current().kind === "custom"
                      ? "providers.kind.custom"
                      : "providers.kind.builtin",
                )}
              </Badge>
              <Badge tone={current().enabled ? "success" : "warning"}>
                {i18n.t(current().enabled ? "providers.status.enabled" : "providers.status.disabled")}
              </Badge>
            </div>

            <Show when={actor()?.role === "owner" || actor()?.role === "admin"}>
              <ProviderForm
                kind={current().kind}
                provider={current()}
                error={error()}
                pending={pending()}
                onSubmit={onSubmit}
              />
              <Show when={saved()}>
                <p class="mt-3 text-xs text-emerald-700">{i18n.t("providers.saved")}</p>
              </Show>
              <Show when={isOwner()}>
                <div class="mt-6 border-t border-slate-100 pt-4">
                  <Button variant="danger" size="sm" disabled={pending()} onClick={onRemove}>
                    {i18n.t("providers.form.remove")}
                  </Button>
                </div>
              </Show>
            </Show>

            <Show when={actor()?.role !== "owner" && actor()?.role !== "admin"}>
              <p class="text-sm text-slate-500">{i18n.t("users.new.error.forbidden")}</p>
            </Show>
          </Card>
        )}
      </Show>
    </div>
  )
}
