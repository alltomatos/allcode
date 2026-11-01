import { A, createAsync, revalidate, useAction, useNavigate } from "@solidjs/router"
import { Show, createSignal } from "solid-js"
import { ProviderForm, type ProviderFormValue } from "~/components/provider-form"
import { Card, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createProvider, requireMe } from "~/lib/actions"

export default function NewProviderPage() {
  const i18n = useI18n()
  const navigate = useNavigate()
  const actor = createAsync(() => requireMe())
  const create = useAction(createProvider)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)

  async function onSubmit(value: ProviderFormValue) {
    setPending(true)
    setError(null)
    const result = await create(value)
    setPending(false)
    if (result?.error) {
      setError(i18n.t(result.error))
      return
    }
    revalidate("panel.providers")
    revalidate("panel.providers.usage")
    navigate("/app/provedores")
  }

  return (
    <div class="max-w-3xl">
      <PageHeader
        title={i18n.t("providers.form.newTitle")}
        subtitle={i18n.t("providers.subtitle")}
        actions={
          <A href="/app/provedores" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Show
        when={actor()?.role === "owner" || actor()?.role === "admin"}
        fallback={
          <Card>
            <p class="text-sm text-slate-500">{i18n.t("users.new.error.forbidden")}</p>
          </Card>
        }
      >
        <ProviderForm error={error()} pending={pending()} onSubmit={onSubmit} />
      </Show>
    </div>
  )
}
