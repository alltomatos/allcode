import { A, createAsync, revalidate, useAction, useNavigate } from "@solidjs/router"
import { Show, createSignal } from "solid-js"
import { ProviderForm, type ProviderFormValue } from "~/components/provider-form"
import type { ProviderKind } from "~/lib/store"
import { Card, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createProvider, requireMe } from "~/lib/actions"

export default function NewProviderPage() {
  const i18n = useI18n()
  const navigate = useNavigate()
  const actor = createAsync(() => requireMe())
  const create = useAction(createProvider)
  const [kind, setKind] = createSignal<ProviderKind>("builtin")
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

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium ${
      active ? "bg-slate-900 text-white" : "text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50"
    }`

  return (
    <div>
      <PageHeader
        title={i18n.t("providers.form.newTitle")}
        subtitle={i18n.t("providers.subtitle")}
        actions={
          <A href="/app/provedores" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Card class="max-w-2xl">
        <Show when={actor()?.role === "owner" || actor()?.role === "admin"}>
          <div class="mb-4 flex flex-wrap gap-2">
            <button type="button" class={tabClass(kind() === "builtin")} onClick={() => setKind("builtin")}>
              {i18n.t("providers.add.builtin")}
            </button>
            <button type="button" class={tabClass(kind() === "proxy")} onClick={() => setKind("proxy")}>
              {i18n.t("providers.add.proxy")}
            </button>
            <button type="button" class={tabClass(kind() === "custom")} onClick={() => setKind("custom")}>
              {i18n.t("providers.add.custom")}
            </button>
          </div>
          <ProviderForm kind={kind()} error={error()} pending={pending()} onSubmit={onSubmit} />
        </Show>
        <Show when={actor()?.role !== "owner" && actor()?.role !== "admin"}>
          <p class="text-sm text-slate-500">{i18n.t("users.new.error.forbidden")}</p>
        </Show>
      </Card>
    </div>
  )
}
