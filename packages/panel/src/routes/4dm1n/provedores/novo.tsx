import { A, revalidate, useAction, useNavigate } from "@solidjs/router"
import { createSignal } from "solid-js"
import { ProviderForm, type ProviderFormValue } from "~/components/provider-form"
import { PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createGlobalProvider } from "~/lib/actions"

export default function NewGlobalProviderPage() {
  const i18n = useI18n()
  const navigate = useNavigate()
  const create = useAction(createGlobalProvider)
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
    revalidate("panel.admin.providers")
    revalidate("panel.providers")
    navigate("/4dm1n/provedores")
  }

  return (
    <div class="max-w-3xl">
      <PageHeader
        title="Novo Provedor Global"
        subtitle="Disponível para todas as empresas administradas pela plataforma."
        actions={
          <A href="/4dm1n/provedores" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />
      <ProviderForm error={error()} pending={pending()} onSubmit={onSubmit} />
    </div>
  )
}
