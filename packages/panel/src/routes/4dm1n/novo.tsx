import { A, createAsync, revalidate, useAction } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Button, Card, Field, PageHeader, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createTenant, listResellers } from "~/lib/actions"

type IssuedTenant = {
  tenantId: string
  tenantName: string
  ownerEmail: string
  tempPassword?: string
}

export default function NewTenantPage() {
  const i18n = useI18n()
  const create = useAction(createTenant)
  const resellers = createAsync(() => listResellers())
  const [issued, setIssued] = createSignal<IssuedTenant | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)
  const [copied, setCopied] = createSignal(false)
  const [slug, setSlug] = createSignal("")
  const [logoUrl, setLogoUrl] = createSignal("")
  const [uploading, setUploading] = createSignal(false)
  const [planType, setPlanType] = createSignal("trial")

  function onNameInput(e: InputEvent & { currentTarget: HTMLInputElement }) {
    const val = e.currentTarget.value
    setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"))
  }

  async function onUploadFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload-logo", {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as { ok?: boolean; url?: string; error?: string }
      if (data.ok && data.url) {
        setLogoUrl(data.url)
      } else {
        setError(data.error || "Falha ao enviar arquivo")
      }
    } catch (err: any) {
      setError(err?.message || "Erro de rede no upload")
    } finally {
      setUploading(false)
    }
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
      setLogoUrl("")
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
        title="Criar Nova Empresa"
        subtitle="Provisione a organização, identidade visual, ciclo de trial e crie o gestor inicial com senha temporária."
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
                1. Dados da Empresa e Licenciamento
              </h2>
              <div class="space-y-4">
                <Field
                  label="Nome da Empresa"
                  name="name"
                  required
                  placeholder="Ex: Empresa Exemplo Lda"
                  onInput={onNameInput}
                />
                <Field
                  label="Identificador único (slug)"
                  name="slug"
                  required
                  value={slug()}
                  onInput={(e) => setSlug(e.currentTarget.value)}
                  placeholder="empresa-exemplo"
                  hint="Usado para isolamento de dados e identificação da organização."
                />
                <div class="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Limite de assentos / colaboradores"
                    name="maxUsers"
                    type="number"
                    value="15"
                    required
                  />
                  <Select
                    label="Tipo de Plano"
                    name="planType"
                    value={planType()}
                    onSelect={(val) => setPlanType(val)}
                  >
                    <option value="trial">Avaliação / Trial</option>
                    <option value="paid">Plano Definitivo (Pago)</option>
                  </Select>
                </div>

                <Show when={planType() === "trial"}>
                  <div class="rounded-lg bg-amber-50/60 p-3 ring-1 ring-amber-200">
                    <Field
                      label="Duração do Período de Trial (em dias)"
                      name="trialDays"
                      type="number"
                      value="14"
                      required
                      hint="O acesso dos colaboradores será bloqueado automaticamente após este prazo se não for prorrogado ou migrado para pago."
                    />
                  </div>
                </Show>

                <Show when={(resellers() ?? []).length > 0}>
                  <Select label="Revendedor Parceiro (Opcional)" name="resellerID">
                    <option value="">— Venda Direta AllCode (Sem revenda) —</option>
                    <For each={resellers() ?? []}>
                      {(reseller) => <option value={reseller.id}>{reseller.name} ({reseller.contactEmail})</option>}
                    </For>
                  </Select>
                </Show>
              </div>
            </div>

            {/* Seção de Branding e Onboarding */}
            <div class="border-t border-slate-100 pt-5">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                2. Branding e Mensagem de Boas-vindas
              </h2>
              <div class="space-y-4">
                <div>
                  <Field
                    label="URL da Logo da Empresa"
                    name="logoUrl"
                    value={logoUrl()}
                    onInput={(e) => setLogoUrl(e.currentTarget.value)}
                    placeholder="https://.../logo.png ou envie o arquivo abaixo"
                  />
                  <div class="mt-2 flex items-center gap-3">
                    <label class="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100 cursor-pointer shadow-2xs">
                      <span>📁 {uploading() ? "Enviando imagem..." : "Enviar arquivo de logo"}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        class="hidden"
                        disabled={uploading()}
                        onChange={onUploadFile}
                      />
                    </label>
                    <span class="text-[11px] text-slate-400">PNG, JPG, SVG ou WEBP até 5MB</span>
                  </div>
                </div>

                <Show when={logoUrl()}>
                  <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div class="grid size-12 place-items-center rounded-lg border border-slate-100 bg-white p-1">
                      <img src={logoUrl()} alt="Pré-visualização da logo" class="max-h-full max-w-full object-contain" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-medium text-slate-900">Logo pronta para exibição</div>
                      <div class="truncate font-mono text-[11px] text-slate-400">{logoUrl()}</div>
                    </div>
                  </div>
                </Show>

                <Field
                  label="Mensagem de Boas-vindas Personalizada"
                  name="welcomeMessage"
                  placeholder="Ex: Bem-vindo ao portal da Empresa! Utilize as credenciais fornecidas pela TI para acessar os modelos e ferramentas homologadas."
                  hint="Esta mensagem será apresentada aos membros e novos usuários no onboarding do portal e do desktop."
                />
              </div>
            </div>

            <div class="border-t border-slate-100 pt-5">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                3. Gestor / Administrador Inicial
              </h2>
              <div class="space-y-4">
                <Field
                  label="Nome do Gestor"
                  name="ownerName"
                  required
                  placeholder="Carlos Alberto (Gestor)"
                />
                <Field
                  label="E-mail do Gestor"
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

            <Button type="submit" class="w-full" disabled={pending() || uploading()}>
              {pending() ? i18n.t("common.loading") : "Criar Empresa e Gestor"}
            </Button>
          </form>
        </Card>

        <Show when={issued()}>
          {(res) => (
            <Card class="border border-emerald-300 bg-emerald-50/50">
              <div class="flex items-center gap-2">
                <span class="text-lg">🎉</span>
                <h2 class="text-sm font-semibold text-emerald-950">Empresa e conta de Gestor criados com sucesso!</h2>
              </div>
              <p class="mt-2 text-xs text-slate-600">
                A empresa foi provisionada e o gestor inicial já pode entrar no sistema. Entregue os dados com segurança:
              </p>

              <dl class="mt-4 space-y-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 text-sm">
                <div>
                  <dt class="text-xs text-slate-500">Empresa</dt>
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
                  Ver painel da empresa →
                </A>
              </div>
            </Card>
          )}
        </Show>
      </div>
    </div>
  )
}
