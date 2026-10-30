import { A, revalidate, useAction } from "@solidjs/router"
import { Show, createSignal } from "solid-js"
import { Button, Card, Field, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createTenant } from "~/lib/actions"

type IssuedTenant = {
  tenantId: string
  tenantName: string
  ownerEmail: string
  tempPassword?: string
}

export default function NewTenantPage() {
  const i18n = useI18n()
  const create = useAction(createTenant)
  const [issued, setIssued] = createSignal<IssuedTenant | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)
  const [copied, setCopied] = createSignal(false)
  const [slug, setSlug] = createSignal("")

  function onNameInput(e: InputEvent & { currentTarget: HTMLInputElement }) {
    const val = e.currentTarget.value
    // Sugere slug automaticamente se ainda não alterado manualmente
    setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"))
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    setPending(true)
    setError(null)
    const result = await create(new FormData(form))
    setPending(false)
    if (!result) return
    if (result.error) {
      setError(i18n.t(result.error))
      return
    }
    if (result.tenantId) {
      setIssued({
        tenantId: result.tenantId,
        tenantName: result.tenantName,
        ownerEmail: result.ownerEmail,
        tempPassword: result.tempPassword,
      })
      form.reset()
      setSlug("")
      revalidate("panel.admin.tenants")
      revalidate("panel.admin.stats")
    }
  }

  async function copy() {
    const value = issued()?.tempPassword
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title={i18n.t("admin.tenants.new.title")}
        subtitle={i18n.t("admin.tenants.new.subtitle")}
        actions={
          <A href="/4dm1n" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <form onSubmit={submit} class="space-y-6">
            <div>
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                1. {i18n.t("admin.tenants.new.orgSection")}
              </h2>
              <div class="space-y-4">
                <Field
                  label={i18n.t("admin.tenants.new.orgName")}
                  name="name"
                  required
                  placeholder="Ex: Empresa Exemplo Lda"
                  onInput={onNameInput}
                />
                <Field
                  label={i18n.t("admin.tenants.new.orgSlug")}
                  name="slug"
                  required
                  value={slug()}
                  onInput={(e) => setSlug(e.currentTarget.value)}
                  placeholder="empresa-exemplo"
                  hint={i18n.t("admin.tenants.new.orgSlugHint")}
                />
                <Field
                  label={i18n.t("admin.tenants.new.maxUsers")}
                  name="maxUsers"
                  type="number"
                  value="15"
                  required
                />
              </div>
            </div>

            <div class="border-t border-slate-100 pt-5">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                2. {i18n.t("admin.tenants.new.ownerSection")}
              </h2>
              <div class="space-y-4">
                <Field
                  label={i18n.t("admin.tenants.new.ownerName")}
                  name="ownerName"
                  required
                  placeholder="Carlos Alberto (Gestor)"
                />
                <Field
                  label={i18n.t("admin.tenants.new.ownerEmail")}
                  name="ownerEmail"
                  type="email"
                  required
                  placeholder="carlos@empresaexemplo.pt"
                  autocomplete="off"
                />
              </div>
            </div>

            <Show when={error()}>
              <div class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {error()}
              </div>
            </Show>

            <Button type="submit" class="w-full" disabled={pending()}>
              {pending() ? i18n.t("common.loading") : i18n.t("admin.tenants.new.submit")}
            </Button>
          </form>
        </Card>

        <Show when={issued()}>
          {(res) => (
            <Card class="border border-emerald-300 bg-emerald-50/50">
              <div class="flex items-center gap-2">
                <span class="text-lg">🎉</span>
                <h2 class="text-sm font-semibold text-emerald-950">{i18n.t("admin.tenants.new.success")}</h2>
              </div>
              <p class="mt-2 text-xs text-slate-600">
                A organização foi provisionada e o gestor inicial já pode entrar no sistema. Entregue os dados com segurança:
              </p>

              <dl class="mt-4 space-y-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 text-sm">
                <div>
                  <dt class="text-xs text-slate-500">{i18n.t("admin.tenants.col.company")}</dt>
                  <dd class="font-semibold text-slate-900">{res().tenantName}</dd>
                </div>
                <div>
                  <dt class="text-xs text-slate-500">{i18n.t("common.email")}</dt>
                  <dd class="font-medium text-slate-900">{res().ownerEmail}</dd>
                </div>
                <div>
                  <dt class="text-xs text-slate-500">{i18n.t("login.password")} (Temporária)</dt>
                  <dd class="mt-1 flex items-center gap-2">
                    <code class="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm text-slate-900 ring-1 ring-slate-200 select-all">
                      {res().tempPassword}
                    </code>
                    <button
                      type="button"
                      class="text-xs font-semibold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                      onClick={copy}
                    >
                      {copied() ? i18n.t("common.copied") : i18n.t("users.new.copyPassword")}
                    </button>
                  </dd>
                </div>
              </dl>

              <div class="mt-4 flex gap-2">
                <A
                  href={`/4dm1n/${res().tenantId}`}
                  class="text-xs font-medium text-indigo-700 hover:underline"
                >
                  Ver painel do tenant →
                </A>
              </div>
            </Card>
          )}
        </Show>
      </div>
    </div>
  )
}
