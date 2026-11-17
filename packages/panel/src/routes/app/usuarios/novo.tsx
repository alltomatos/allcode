import { A, createAsync, revalidate, useAction } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Button, Card, Field, PageHeader, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createUser, listGroups, listProviders, me } from "~/lib/actions"

type Issued = { email: string; password: string }

export default function NewUserPage() {
  const i18n = useI18n()
  const create = useAction(createUser)
  const actor = createAsync(() => me())
  const groups = createAsync(() => listGroups())
  const providers = createAsync(() => listProviders())
  const [issued, setIssued] = createSignal<Issued | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)
  const [copied, setCopied] = createSignal(false)
  const [selectedProviderID, setSelectedProviderID] = createSignal("")
  const [selectedModelID, setSelectedModelID] = createSignal("")

  const activeProvider = () =>
    (providers() ?? []).find((p) => p.providerID === selectedProviderID())
  const availableModels = () => (activeProvider()?.models ?? []).filter((m) => m.enabled !== false)

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    setPending(true)
    setError(null)
    const result = await create(new FormData(form))
    setPending(false)
    if (!result) return
    if (result.error) {
      if (result.error === "users.new.error.seatLimit") {
        setError(
          `Limite de ${result.limit} colaboradores do plano atingido (${result.used} em uso). Aumente os assentos no portal ou remova um usuário.`,
        )
        return
      }
      setError(i18n.t(result.error))
      return
    }
    if (!("password" in result) || !result.password) return
    setIssued({ email: result.email, password: result.password })
    form.reset()
    revalidate("panel.users")
    revalidate("panel.stats")
    revalidate("panel.audit")
  }

  async function copy() {
    const value = issued()
    if (!value) return
    await navigator.clipboard.writeText(value.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title={i18n.t("users.new.title")}
        subtitle={i18n.t("users.new.subtitle")}
        actions={
          <A href="/app/usuarios" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            {i18n.t("common.back")}
          </A>
        }
      />

      <div class="grid gap-6 lg:grid-cols-2">
        <Card>
          <form onSubmit={submit} class="space-y-4">
            <Field label={i18n.t("users.new.name")} name="name" required placeholder="Maria Silva" />
            <Field
              label={i18n.t("users.new.email")}
              name="email"
              type="email"
              required
              placeholder="maria@empresa.com"
              autocomplete="off"
            />
            <Select label={i18n.t("users.new.role")} name="role" value="member">
              <option value="member">{i18n.t("users.role.member")}</option>
              <option value="admin">{i18n.t("users.role.admin")}</option>
            </Select>

            <Field
              label={i18n.t("quota.user.limit")}
              name="tokenQuota"
              placeholder={i18n.t("quota.user.placeholder")}
              hint={i18n.t("quota.company.limitHint")}
            />

            <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                {i18n.t("user.permissions.title")}
              </span>

              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="canUseAgentUI"
                  checked
                  class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div class="text-xs">
                  <span class="font-semibold text-slate-900 block">{i18n.t("user.permissions.agentui")}</span>
                  <span class="text-slate-500">{i18n.t("user.permissions.agentuiDesc")}</span>
                </div>
              </label>

              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="canUseRoutines"
                  checked
                  class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div class="text-xs">
                  <span class="font-semibold text-slate-900 block">{i18n.t("user.permissions.routines")}</span>
                  <span class="text-slate-500">{i18n.t("user.permissions.routinesDesc")}</span>
                </div>
              </label>

              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="canChangePassword"
                  checked
                  class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div class="text-xs">
                  <span class="font-semibold text-slate-900 block">{i18n.t("user.permissions.changePassword")}</span>
                  <span class="text-slate-500">{i18n.t("user.permissions.changePasswordDesc")}</span>
                </div>
              </label>

              <Show when={actor()?.role === "owner"}>
                <div class="mt-2 border-t border-slate-200/60 pt-2">
                  <label class="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="auditExempt"
                      class="mt-1 size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div class="text-xs">
                      <span class="font-semibold text-slate-900 block">{i18n.t("user.permissions.auditExempt")}</span>
                      <span class="text-slate-500">{i18n.t("user.permissions.auditExemptDesc")}</span>
                    </div>
                  </label>
                </div>
              </Show>
            </div>

              <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  {i18n.t("access.defaults.title")}
                </span>
                <Select
                  label={i18n.t("access.defaults.provider")}
                  name="defaultProvider"
                  value={selectedProviderID()}
                  onSelect={(val) => {
                    setSelectedProviderID(val)
                    setSelectedModelID("")
                  }}
                >
                  <option value="">— {i18n.t("access.defaults.provider")} —</option>
                  <For each={(providers() ?? []).filter((provider) => provider.enabled)}>
                    {(provider) => <option value={provider.providerID}>{provider.displayName}</option>}
                  </For>
                </Select>

                <Show
                  when={availableModels().length > 0}
                  fallback={
                    <Field
                      label={i18n.t("access.defaults.model")}
                      name="defaultModel"
                      value={selectedModelID()}
                      placeholder="Selecione um provedor com modelos disponíveis"
                      autocomplete="off"
                      onInput={(e) => setSelectedModelID(e.currentTarget.value)}
                    />
                  }
                >
                  <Select
                    label={i18n.t("access.defaults.model")}
                    name="defaultModel"
                    value={selectedModelID()}
                    onSelect={setSelectedModelID}
                  >
                    <option value="">— Nenhum modelo padrão —</option>
                    <For each={availableModels()}>
                      {(model) => <option value={model.id}>{model.name || model.id}</option>}
                    </For>
                  </Select>
                </Show>
                <p class="text-[11px] text-slate-500">{i18n.t("access.defaults.hint")}</p>
              </div>

              <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  {i18n.t("access.groups.title")}
                </span>
                <Show
                  when={(groups() ?? []).length > 0}
                  fallback={<p class="text-[11px] text-slate-500">{i18n.t("access.groups.empty")}</p>}
                >
                  <For each={groups() ?? []}>
                    {(group) => (
                      <label class="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          name="groupIds"
                          value={group.id}
                          class="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{group.name}</span>
                      </label>
                    )}
                  </For>
                </Show>
              </div>

              <div class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {i18n.t("users.new.tempPasswordHint")}
              </div>

            <Show when={error()}>
              <div class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                {error()}
              </div>
            </Show>

            <Button type="submit" class="w-full" disabled={pending()}>
              {pending() ? i18n.t("common.loading") : i18n.t("users.new.submit")}
            </Button>
          </form>
        </Card>

        <Show when={issued()}>
          {(credential) => (
            <Card class="border border-emerald-200 bg-emerald-50/40">
              <h2 class="text-sm font-semibold text-emerald-900">{i18n.t("users.new.success")}</h2>
              <dl class="mt-4 space-y-3 text-sm">
                <div>
                  <dt class="text-xs text-slate-500">{i18n.t("common.email")}</dt>
                  <dd class="font-medium text-slate-900">{credential().email}</dd>
                </div>
                <div>
                  <dt class="text-xs text-slate-500">{i18n.t("login.password")}</dt>
                  <dd class="mt-1 flex items-center gap-2">
                    <code class="rounded-md bg-white px-2 py-1 font-mono text-sm text-slate-900 ring-1 ring-slate-200">
                      {credential().password}
                    </code>
                    <button
                      type="button"
                      class="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                      onClick={copy}
                    >
                      {copied() ? i18n.t("common.copied") : i18n.t("users.new.copyPassword")}
                    </button>
                  </dd>
                </div>
              </dl>
              <p class="mt-4 text-xs text-slate-600">{i18n.t("user.detail.mustChange")}</p>
            </Card>
          )}
        </Show>
      </div>
    </div>
  )
}
