import { A, createAsync, revalidate, useAction, useParams } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import {
  getResellerTenant,
  setResellerTenantStatus,
  updateResellerTenantLimits,
  extendResellerTenantTrial,
  listPlans,
  setResellerTenantPlan,
} from "~/lib/actions"
import { getEffectiveOrgStatus, getTrialDaysRemaining, computePlanMonthlyCents } from "~/lib/store"
import { formatDate, formatBRL, planErrorMessage, roleKey, roleTone, statusKey, statusTone } from "~/lib/labels"

export default function ResellerTenantDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const data = createAsync(() => getResellerTenant(params.id!))
  const plans = createAsync(() => listPlans(false))
  const changeStatus = useAction(setResellerTenantStatus)
  const changeLimits = useAction(updateResellerTenantLimits)
  const extendTrialAction = useAction(extendResellerTenantTrial)
  const changePlanAction = useAction(setResellerTenantPlan)

  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal<string | null>(null)
  const [newLimit, setNewLimit] = createSignal("")
  const [extending, setExtending] = createSignal(false)

  async function onToggleStatus() {
    const org = data()?.org
    if (!org) return
    const nextStatus = org.status === "active" ? "suspended" : "active"
    const res = await changeStatus(org.id, nextStatus)
    if (res?.error) setError("Não foi possível alterar o status da empresa.")
    else {
      revalidate("panel.reseller.tenant")
      revalidate("panel.reseller.dashboard")
    }
  }

  async function onUpdateLimits(e: SubmitEvent) {
    e.preventDefault()
    const org = data()?.org
    if (!org) return
    const limit = Number(newLimit() || org.maxUsers)
    if (limit <= 0) return
    const res = await changeLimits(org.id, limit)
    if (res?.error) setError(planErrorMessage(res))
    else {
      setNewLimit("")
      setSuccess("Limite de licenças atualizado com sucesso!")
      revalidate("panel.reseller.tenant")
      revalidate("panel.reseller.dashboard")
    }
  }

  async function onAssignPlan(planID: string) {
    const org = data()?.org
    if (!org) return
    setError(null)
    setSuccess(null)
    const res = await changePlanAction(org.id, planID)
    if (res?.error) {
      setError(planErrorMessage(res))
      return
    }
    setSuccess("Plano comercial atualizado!")
    revalidate("panel.reseller.tenant")
    revalidate("panel.reseller.dashboard")
  }

  async function onExtendTrial(days: number) {    const org = data()?.org
    if (!org) return
    setExtending(true)
    setError(null)
    setSuccess(null)
    const res = await extendTrialAction(org.id, days)
    setExtending(false)
    if (res?.error) {
      setError("Falha ao prorrogar período de testes.")
    } else {
      setSuccess(`Período de avaliação ampliado com sucesso por mais +${days} dias!`)
      revalidate("panel.reseller.tenant")
      revalidate("panel.reseller.dashboard")
    }
  }

  return (
    <div>
      <PageHeader
        title={data()?.org.name ?? "Detalhes da Empresa"}
        subtitle={`Empresa Cliente: ${params.id}`}
        actions={
          <A href="/revenda" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Minhas Empresas
          </A>
        }
      />

      <Show when={data()} fallback={<p class="text-sm text-slate-500">{i18n.t("common.loading")}</p>}>
        {(current) => {
          const effective = () => getEffectiveOrgStatus(current().org)
          const daysLeft = () => getTrialDaysRemaining(current().org)
          const currentPlan = () => (plans() ?? []).find((plan) => plan.id === current().org.planID)
          const assignablePlans = () =>
            (plans() ?? []).filter((plan) => plan.isActive || plan.id === current().org.planID)
          return (
            <div class="space-y-6">
              <div class="grid gap-6 lg:grid-cols-3">
                <Card class="lg:col-span-2">
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm font-semibold text-slate-900">Dados da Empresa Cliente</h2>
                    <Show when={current().org.logoUrl}>
                      <div class="size-10 rounded-lg border border-slate-200 p-1 bg-white flex items-center justify-center">
                        <img src={current().org.logoUrl} alt="Logo" class="max-h-full max-w-full object-contain" />
                      </div>
                    </Show>
                  </div>

                  <dl class="grid gap-4 sm:grid-cols-2 text-sm">
                    <div>
                      <dt class="text-xs text-slate-500">Razão Social / Nome</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">{current().org.name}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">Slug de Acesso</dt>
                      <dd class="mt-0.5 font-mono text-slate-700">{current().org.slug}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">Status Operacional</dt>
                      <dd class="mt-0.5 flex items-center gap-2">
                        <Badge tone={effective() === "active" ? "success" : effective() === "trial" ? "brand" : "danger"}>
                          {effective() === "active"
                            ? "Plano Pago Ativo"
                            : effective() === "trial"
                              ? `Em Avaliação (${daysLeft() ?? 0} dias restantes)`
                              : effective() === "expired"
                                ? "Trial Expirado (Bloqueado)"
                                : "Suspenso"}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">Tipo de Contrato</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">
                        {current().org.planType === "paid" ? "Licenciamento Pago" : "Período de Demonstração (Trial)"}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">Plano Comercial</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">
                        {currentPlan()?.name ?? "Preço padrão por assento"}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">Mensalidade</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">
                        {formatBRL(computePlanMonthlyCents(current().org, currentPlan()))} / mês
                      </dd>
                    </div>

                    <Show when={current().org.planType === "trial" && current().org.trialEndsAt}>
                      <div>
                        <dt class="text-xs text-slate-500">Data Limite de Avaliação</dt>
                        <dd class="mt-0.5 font-medium text-slate-900">
                          {formatDate(current().org.trialEndsAt, i18n.locale())}
                        </dd>
                      </div>
                    </Show>

                    <div>
                      <dt class="text-xs text-slate-500">Licenças Contratadas</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">{current().org.maxUsers} colaboradores</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">{i18n.t("common.createdAt")}</dt>
                      <dd class="mt-0.5 text-slate-700">{formatDate(current().org.createdAt, i18n.locale())}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">E-mail Principal</dt>
                      <dd class="mt-0.5 text-slate-700">{current().org.contactEmail ?? "—"}</dd>
                    </div>
                  </dl>

                  <Show when={current().org.welcomeMessage}>
                    <div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div class="font-semibold text-slate-700 mb-1">Mensagem de Boas-Vindas Configurada:</div>
                      <p class="text-slate-600 italic">"{current().org.welcomeMessage}"</p>
                    </div>
                  </Show>
                </Card>

                <Card>
                  <h2 class="text-sm font-semibold text-slate-900 mb-4">Controles da Revenda</h2>
                  <div class="space-y-4">
                    {/* Prorrogação de Trial */}
                    <div class="space-y-2">
                      <div class="text-xs font-semibold text-slate-900">Prorrogar Demonstração (Trial)</div>
                      <div class="grid grid-cols-3 gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={extending()}
                          onClick={() => onExtendTrial(7)}
                        >
                          +7 Dias
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={extending()}
                          onClick={() => onExtendTrial(14)}
                        >
                          +14 Dias
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={extending()}
                          onClick={() => onExtendTrial(30)}
                        >
                          +30 Dias
                        </Button>
                      </div>
                      <p class="text-[11px] text-slate-500">
                        Adiciona dias à data de expiração desta empresa cliente.
                      </p>
                    </div>

                    <form onSubmit={onUpdateLimits} class="border-t border-slate-100 pt-4 space-y-2">
                      <Field
                        label="Alterar Assentos / Colaboradores"
                        name="maxUsers"
                        type="number"
                        value={newLimit() || String(current().org.maxUsers)}
                        onInput={(e) => setNewLimit(e.currentTarget.value)}
                      />
                      <Button type="submit" variant="secondary" size="sm" class="w-full">
                        Salvar Assentos
                      </Button>
                    </form>

                    <div class="border-t border-slate-100 pt-4 space-y-2">
                      <div class="text-xs font-semibold text-slate-900">Plano Comercial</div>
                      <div class="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        <div class="flex items-center justify-between">
                          <span>Mensalidade</span>
                          <strong class="text-slate-900">
                            {formatBRL(computePlanMonthlyCents(current().org, currentPlan()))} / mês
                          </strong>
                        </div>
                        <div class="mt-0.5 text-slate-500">
                          {currentPlan()
                            ? currentPlan()!.name
                            : "Sem plano atribuído (preço padrão por assento)"}
                        </div>
                      </div>
                      <Select
                        label="Alterar plano"
                        name="planID"
                        value={current().org.planID || ""}
                        onSelect={(value) => onAssignPlan(value)}
                      >
                        <option value="">— Sem plano (preço padrão) —</option>
                        <For each={assignablePlans()}>
                          {(plan) => (
                            <option value={plan.id}>
                              {plan.name} — {formatBRL(plan.priceCents)}
                              {plan.pricingMode === "package" ? " / pacote" : " / usuário"}
                              {plan.isActive ? "" : " (inativo)"}
                            </option>
                          )}
                        </For>
                      </Select>
                    </div>

                    <div class="border-t border-slate-100 pt-4">
                      <Button
                        variant={current().org.status === "active" ? "danger" : "primary"}
                        class="w-full"
                        onClick={onToggleStatus}
                      >
                        {current().org.status === "active"
                          ? "Suspender Acesso da Empresa"
                          : "Reativar Acesso da Empresa"}
                      </Button>
                    </div>
                  </div>

                  <Show when={error()}>
                    <div class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
                      {error()}
                    </div>
                  </Show>
                  <Show when={success()}>
                    <div class="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
                      {success()}
                    </div>
                  </Show>
                </Card>
              </div>

              <Card>
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-sm font-semibold text-slate-900">
                    Colaboradores Cadastrados ({current().users.length} / {current().org.maxUsers})
                  </h2>
                </div>

                <Show when={current().users.length > 0} fallback={<EmptyState>Nenhum colaborador encontrado nesta empresa.</EmptyState>}>
                  <div class="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                    <table class="w-full text-left text-sm">
                      <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th class="px-4 py-2.5">{i18n.t("common.name")}</th>
                          <th class="px-4 py-2.5">{i18n.t("common.role")}</th>
                          <th class="px-4 py-2.5">{i18n.t("common.status")}</th>
                          <th class="px-4 py-2.5">{i18n.t("common.lastLogin")}</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100">
                        <For each={current().users}>
                          {(u) => (
                            <tr class="hover:bg-slate-50 transition text-xs">
                              <td class="px-4 py-2.5">
                                <div class="font-medium text-slate-900">{u.name}</div>
                                <div class="text-slate-500">{u.email}</div>
                              </td>
                              <td class="px-4 py-2.5">
                                <Badge tone={roleTone(u.role)}>{i18n.t(roleKey(u.role))}</Badge>
                              </td>
                              <td class="px-4 py-2.5">
                                <Badge tone={statusTone(u.status)}>{i18n.t(statusKey(u.status))}</Badge>
                              </td>
                              <td class="px-4 py-2.5 text-slate-500">
                                {u.lastLoginAt ? formatDate(u.lastLoginAt, i18n.locale()) : i18n.t("common.never")}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </div>
                </Show>
              </Card>
            </div>
          )
        }}
      </Show>
    </div>
  )
}
