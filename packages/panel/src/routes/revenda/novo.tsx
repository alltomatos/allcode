import { A, createAsync, useAction } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Button, Card, Field, PageHeader, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createTenantByReseller, listPlans } from "~/lib/actions"
import { formatBRL } from "~/lib/labels"

export default function ResellerNewTenantPage() {
  const i18n = useI18n()
  const create = useAction(createTenantByReseller)
  const plans = createAsync(() => listPlans(true))
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [logoUrl, setLogoUrl] = createSignal<string>("")
  const [uploadingLogo, setUploadingLogo] = createSignal(false)
  const [planType, setPlanType] = createSignal<"trial" | "paid">("trial")
  const [planID, setPlanID] = createSignal("")
  const [seats, setSeats] = createSignal("10")

  const selectedPlan = () => (plans() ?? []).find((plan) => plan.id === planID())
  const estimatedMonthly = () => {
    const plan = selectedPlan()
    const seatsCount = Math.max(1, Number(seats()) || 1)
    if (!plan) return 0
    if (plan.pricingMode === "package") {
      const extra = Math.max(0, seatsCount - (plan.includedUsers ?? 0))
      return plan.priceCents + extra * (plan.extraUserPriceCents ?? 0)
    }
    return plan.priceCents * seatsCount
  }
  const [issued, setIssued] = createSignal<{
    tenantName: string
    adminEmail: string
    tempPassword?: string
    loginUrl: string
  } | null>(null)
  const [copied, setCopied] = createSignal(false)

  async function onLogoSelected(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setUploadingLogo(true)
    setError(null)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      })
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string }
      if (data.ok && data.url) {
        setLogoUrl(data.url)
      } else {
        setError(data.error ?? "Erro ao enviar arquivo de imagem.")
      }
    } catch {
      setError("Falha na conexão durante o upload da imagem.")
    } finally {
      setUploadingLogo(false)
    }
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    setPending(true)
    setError(null)

    const formData = new FormData(form)
    if (logoUrl()) {
      formData.set("logoUrl", logoUrl())
    }
    formData.set("planType", planType())

    const res = await create(formData)
    setPending(false)
    if (res?.error) {
      if (res.error === "admin.tenants.error.nameRequired") setError("Informe o nome da empresa.")
      else if (res.error === "admin.tenants.error.slugRequired") setError("Informe o identificador da empresa.")
      else if (res.error === "admin.tenants.error.slugTaken") setError("Já existe uma empresa com este identificador.")
      else if (res.error === "users.new.error.emailTaken") setError("Este e-mail de administrador já está cadastrado.")
      else if (res.error === "users.new.error.invalidEmail") setError("E-mail de administrador inválido.")
      else if (res.error === "users.new.error.nameRequired") setError("Informe o nome do administrador.")
      else if (res.error === "reseller.error.unauthorized") setError("Acesso não autorizado para esta revenda.")
      else setError("Erro ao cadastrar empresa.")
      return
    }
    if (res?.tenantId) {
      const origin = typeof window !== "undefined" ? window.location.origin : ""
      setIssued({
        tenantName: res.tenantName,
        adminEmail: res.ownerEmail,
        tempPassword: res.tempPassword,
        loginUrl: `${origin}/login`,
      })
    }
  }

  async function copyPassword() {
    const p = issued()?.tempPassword
    if (!p) return
    await navigator.clipboard.writeText(p)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Cadastrar Nova Empresa Cliente"
        subtitle="Provisione um novo ambiente corporativo com identidade visual personalizada e período de avaliação."
        actions={
          <A href="/revenda" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Voltar para Minhas Empresas
          </A>
        }
      />

      <div class="max-w-2xl">
        <Show
          when={issued()}
          fallback={
            <Card>
              <form onSubmit={onSubmit} class="space-y-6">
                <div>
                  <h2 class="text-sm font-semibold text-slate-900">Dados da Empresa Cliente</h2>
                  <p class="text-xs text-slate-500 mt-0.5">
                    Defina o nome comercial e o identificador do novo cliente corporativo.
                  </p>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Nome da Empresa"
                    name="name"
                    required
                    placeholder="Ex: Acert Contabilidade"
                    hint="Nome que aparecerá no cabeçalho e relatórios."
                  />
                  <Field
                    label="Slug de Acesso"
                    name="slug"
                    required
                    placeholder="acert-contabilidade"
                    hint="Identificador único (letras minúsculas e hífens)."
                  />
                </div>

                {/* Upload de Logo e Personalização */}
                <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <div class="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    Identidade Visual & Boas-Vindas
                  </div>

                  <div class="flex items-center gap-4">
                    <div class="size-16 rounded-xl border border-dashed border-slate-300 bg-white grid place-items-center overflow-hidden">
                      <Show
                        when={logoUrl()}
                        fallback={<span class="text-xs text-slate-400 font-medium text-center px-1">Sem Logo</span>}
                      >
                        <img src={logoUrl()} alt="Preview" class="max-h-full max-w-full object-contain p-1" />
                      </Show>
                    </div>

                    <div class="flex-1 space-y-1">
                      <label class="block text-xs font-medium text-slate-700">Logo da Empresa</label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={onLogoSelected}
                        disabled={uploadingLogo()}
                        class="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                      />
                      <p class="text-[11px] text-slate-500">
                        {uploadingLogo() ? "Enviando logo..." : "Formatos aceitos: PNG, JPG, SVG ou WEBP (máx. 5MB)."}
                      </p>
                    </div>
                  </div>

                  <Field
                    label="Mensagem de Boas-Vindas aos Colaboradores"
                    name="welcomeMessage"
                    placeholder="Ex: Sejam bem-vindos à plataforma de IA da Acert Contabilidade!"
                    hint="Aparecerá com destaque no dashboard de todos os funcionários deste cliente."
                  />
                </div>

                {/* Modelo de Licenciamento & Trial */}
                <div class="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                  <div class="text-xs font-semibold text-emerald-950 uppercase tracking-wider">
                    Plano e Período de Avaliação
                  </div>

                  <div class="flex gap-4">
                    <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                      <input
                        type="radio"
                        name="planChoice"
                        checked={planType() === "trial"}
                        onChange={() => setPlanType("trial")}
                        class="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Período de Testes (Trial Gratuito)</span>
                    </label>

                    <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
                      <input
                        type="radio"
                        name="planChoice"
                        checked={planType() === "paid"}
                        onChange={() => setPlanType("paid")}
                        class="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Plano Pago / Definitivo</span>
                    </label>
                  </div>

                  <Show when={planType() === "trial"}>
                    <div class="grid gap-3 sm:grid-cols-2 pt-2">
                      <Field
                        label="Duração Inicial do Trial (Dias)"
                        name="trialDays"
                        type="number"
                        value="14"
                        required
                        hint="Após este prazo, o sistema bloqueia chamadas automaticamente até renovação."
                      />
                      <Field
                        label="Limite de Colaboradores (Assentos)"
                        name="maxUsers"
                        type="number"
                        value={seats()}
                        onInput={(e) => setSeats(e.currentTarget.value)}
                        required
                        hint="Total de contas que podem ser criadas."
                      />
                    </div>
                  </Show>

                  <Show when={planType() === "paid"}>
                    <div class="pt-2">
                      <Field
                        label="Limite de Colaboradores Contratados"
                        name="maxUsers"
                        type="number"
                        value={seats()}
                        onInput={(e) => setSeats(e.currentTarget.value)}
                        required
                        hint="Assentos corporativos liberados para este cliente."
                      />
                    </div>
                  </Show>

                  <Show when={(plans() ?? []).length > 0}>
                    <div class="pt-2 space-y-2">
                      <Select
                        label="Plano Comercial"
                        name="planID"
                        value={planID()}
                        onSelect={(value) => setPlanID(value)}
                      >
                        <option value="">— Preço padrão por assento —</option>
                        <For each={plans() ?? []}>
                          {(plan) => (
                            <option value={plan.id}>
                              {plan.name} — {formatBRL(plan.priceCents)}
                              {plan.pricingMode === "package"
                                ? ` por pacote (${plan.includedUsers ?? 0} usuários)`
                                : " por usuário"}
                            </option>
                          )}
                        </For>
                      </Select>

                      <Show when={selectedPlan()}>
                        <div class="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs">
                          <span class="text-emerald-900 font-medium">Mensalidade estimada</span>
                          <strong class="text-emerald-950">{formatBRL(estimatedMonthly())} / mês</strong>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>

                <div class="border-t border-slate-100 pt-4">
                  <h2 class="text-sm font-semibold text-slate-900">Administrador Inicial do Cliente</h2>
                  <p class="text-xs text-slate-500 mt-0.5 mb-4">
                    Usuário com perfil de administrador na empresa cliente para gerenciar suas equipes.
                  </p>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Nome do Administrador"
                      name="adminName"
                      required
                      placeholder="Ex: Carlos Eduardo"
                    />
                    <Field
                      label="E-mail de Acesso"
                      name="adminEmail"
                      type="email"
                      required
                      placeholder="carlos@empresa.com.br"
                    />
                  </div>
                </div>

                <Show when={error()}>
                  <div class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
                    {error()}
                  </div>
                </Show>

                <div class="flex items-center justify-end gap-3 pt-2">
                  <A href="/revenda" class="text-xs font-medium text-slate-500 hover:text-slate-800">
                    {i18n.t("common.cancel")}
                  </A>
                  <Button type="submit" disabled={pending() || uploadingLogo()}>
                    {pending() ? "Criando ambiente..." : "Concluir Cadastro da Empresa"}
                  </Button>
                </div>
              </form>
            </Card>
          }
        >
          {(res) => (
            <Card>
              <div class="space-y-4">
                <div class="rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200 text-xs text-emerald-950">
                  <div class="flex items-center gap-2 font-bold text-sm text-emerald-900 mb-1">
                    <span>🎉</span> Empresa Cliente Provisionada com Sucesso!
                  </div>
                  <p class="text-emerald-800">
                    O ambiente corporativo da <strong>{res().tenantName}</strong> já está ativo e pronto para uso.
                  </p>

                  <div class="mt-4 rounded-xl border border-emerald-200 bg-white p-4 font-mono text-xs text-slate-900 space-y-2">
                    <div>
                      <span class="text-slate-500">Portal de Acesso:</span>{" "}
                      <a href={res().loginUrl} target="_blank" class="text-emerald-700 underline font-semibold">
                        {res().loginUrl}
                      </a>
                    </div>
                    <div>
                      <span class="text-slate-500">Usuário Administrador:</span>{" "}
                      <strong>{res().adminEmail}</strong>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-slate-500">Senha Provisória:</span>{" "}
                      <code class="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-900">
                        {res().tempPassword}
                      </code>
                      <button
                        type="button"
                        onClick={copyPassword}
                        class="text-emerald-700 hover:underline font-sans text-xs font-semibold cursor-pointer"
                      >
                        {copied() ? "Copiado!" : "Copiar Senha"}
                      </button>
                    </div>
                  </div>

                  <p class="mt-3 text-[11px] text-emerald-700">
                    Ao realizar o primeiro login, o administrador será solicitado a cadastrar sua senha definitiva.
                  </p>
                </div>

                <div class="flex justify-end gap-3 pt-2">
                  <A href="/revenda" class="text-xs font-semibold text-slate-700 hover:text-slate-950 py-2">
                    Ir para Minhas Empresas
                  </A>
                </div>
              </div>
            </Card>
          )}
        </Show>
      </div>
    </div>
  )
}
