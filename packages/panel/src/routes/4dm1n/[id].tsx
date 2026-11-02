import { A, createAsync, revalidate, useAction, useParams } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select } from "~/components/ui"
import { useI18n } from "~/i18n"
import { getTenant, setTenantStatus, updateTenantLimits, extendTenantTrial, setTenantPlanType, listPlans, setTenantPlan } from "~/lib/actions"
import { getTrialDaysRemaining, getEffectiveOrgStatus, computePlanMonthlyCents } from "~/lib/store"
import { formatDate, formatBRL, planErrorMessage, roleKey, roleTone, statusKey, statusTone } from "~/lib/labels"

export default function TenantDetailPage() {
  const i18n = useI18n()
  const params = useParams()
  const data = createAsync(() => getTenant(params.id!))
  const plans = createAsync(() => listPlans(false))
  const changeStatus = useAction(setTenantStatus)
  const changeLimits = useAction(updateTenantLimits)
  const extendTrialAction = useAction(extendTenantTrial)
  const changePlanTypeAction = useAction(setTenantPlanType)
  const changePlanAction = useAction(setTenantPlan)
  const [error, setError] = createSignal<string | null>(null)
  const [success, setSuccess] = createSignal<string | null>(null)
  const [newLimit, setNewLimit] = createSignal("")
  const [extending, setExtending] = createSignal(false)

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
    setSuccess("Plano comercial atualizado com sucesso!")
    revalidate("panel.admin.tenant")
    revalidate("panel.admin.tenants")
    revalidate("panel.admin.stats")
  }

  async function onToggleStatus() {
    const org = data()?.org
    if (!org) return
    const nextStatus = org.status === "active" ? "suspended" : "active"
    const res = await changeStatus(org.id, nextStatus)
    if (res?.error) setError(res.error)
    else {
      revalidate("panel.admin.tenant")
      revalidate("panel.admin.tenants")
      revalidate("panel.admin.stats")
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
      revalidate("panel.admin.tenant")
      revalidate("panel.admin.tenants")
    }
  }

  async function onExtendTrial(days: number) {
    const org = data()?.org
    if (!org) return
    setExtending(true)
    setError(null)
    setSuccess(null)
    const res = await extendTrialAction(org.id, days)
    setExtending(false)
    if (res?.error) {
      setError("Falha ao prorrogar o período de testes.")
    } else {
      setSuccess(`Período de avaliação prorrogado com sucesso por +${days} dias!`)
      revalidate("panel.admin.tenant")
      revalidate("panel.admin.tenants")
      revalidate("panel.admin.stats")
    }
  }

  async function onTogglePlan(type: "trial" | "paid") {
    const org = data()?.org
    if (!org) return
    setError(null)
    setSuccess(null)
    const res = await changePlanTypeAction(org.id, type, 14)
    if (res?.error) {
      setError("Erro ao atualizar plano da empresa.")
    } else {
      setSuccess(type === "paid" ? "Empresa migrada para Plano Definitivo (Pago)!" : "Empresa retornada para modo Trial (14 dias).")
      revalidate("panel.admin.tenant")
      revalidate("panel.admin.tenants")
      revalidate("panel.admin.stats")
    }
  }

  return (
    <div>
      <PageHeader
        title={data()?.org.name ?? "Detalhes da Empresa"}
        subtitle={`Identificador da Empresa: ${params.id}`}
        actions={
          <A href="/4dm1n" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← {i18n.t("common.back")}
          </A>
        }
      />

      <Show when={data()} fallback={<p class="text-sm text-slate-500">{i18n.t("common.loading")}</p>}>
        {(current) => {
          const effective = () => getEffectiveOrgStatus(current().org)
          const daysLeft = () => getTrialDaysRemaining(current().org)
          const currentPlan = () => (plans() ?? []).find((plan) => plan.id === current().org.planID)
          return (
            <div class="space-y-6">
              <div class="grid gap-6 lg:grid-cols-3">
                <Card class="lg:col-span-2">
                  <div class="flex items-center justify-between mb-4">
                    <h2 class="text-sm font-semibold text-slate-900">Informações Gerais da Empresa</h2>
                    <Show when={current().org.logoUrl}>
                      <div class="size-10 rounded-lg border border-slate-200 p-1 bg-white flex items-center justify-center">
                        <img src={current().org.logoUrl} alt="Logo" class="max-h-full max-w-full object-contain" />
                      </div>
                    </Show>
                  </div>

                  <dl class="grid gap-4 sm:grid-cols-2 text-sm">
                    <div>
                      <dt class="text-xs text-slate-500">Empresa</dt>
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
                            ? "Ativo (Pago)"
                            : effective() === "trial"
                              ? `Em Avaliação (${daysLeft() ?? 0} dias restantes)`
                              : effective() === "expired"
                                ? "Trial Expirado (Bloqueado)"
                                : "Suspenso"}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">Tipo de Plano</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">
                        {current().org.planType === "paid" ? "Plano Corporativo Definitivo" : "Período de Avaliação / Trial"}
                      </dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">Plano Comercial</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">
                        {currentPlan()?.name ?? "Preço padrão por assento"}
                      </dd>
                    </div>

                    <Show when={current().org.planType === "trial" && current().org.trialEndsAt}>
                      <div>
                        <dt class="text-xs text-slate-500">Expiração do Trial</dt>
                        <dd class="mt-0.5 font-medium text-slate-900">
                          {formatDate(current().org.trialEndsAt, i18n.locale())}
                        </dd>
                      </div>
                    </Show>

                    <div>
                      <dt class="text-xs text-slate-500">Capacidade de Licenças</dt>
                      <dd class="mt-0.5 font-medium text-slate-900">{current().org.maxUsers} colaboradores</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">{i18n.t("common.createdAt")}</dt>
                      <dd class="mt-0.5 text-slate-700">{formatDate(current().org.createdAt, i18n.locale())}</dd>
                    </div>
                    <div>
                      <dt class="text-xs text-slate-500">{i18n.t("common.email")}</dt>
                      <dd class="mt-0.5 text-slate-700">{current().org.contactEmail ?? "—"}</dd>
                    </div>
                  </dl>

                  <Show when={current().org.welcomeMessage}>
                    <div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div class="font-semibold text-slate-700 mb-1">Mensagem de Boas-Vindas no Onboarding:</div>
                      <p class="text-slate-600 italic">"{current().org.welcomeMessage}"</p>
                    </div>
                  </Show>
                </Card>

                <Card>
                  <h2 class="text-sm font-semibold text-slate-900 mb-4">{i18n.t("common.actions")}</h2>
                  <div class="space-y-4">
                    <div>
                      <Button
                        variant={current().org.status === "active" ? "danger" : "primary"}
                        class="w-full"
                        onClick={onToggleStatus}
                      >
                        {current().org.status === "active"
                          ? "Suspender Empresa"
                          : "Reativar Empresa"}
                      </Button>
                      <p class="mt-1.5 text-[11px] text-slate-500">
                        Suspender bloqueia o acesso de todos os colaboradores deste cliente imediatamente.
                      </p>
                    </div>

                    {/* Prorrogação de Trial e Gestão de Plano */}
                    <div class="border-t border-slate-100 pt-4 space-y-2">
                      <div class="text-xs font-semibold text-slate-900">Ciclo de Trial e Licença</div>
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

                      <div class="pt-2">
                        <Show
                          when={current().org.planType === "paid"}
                          fallback={
                            <Button
                              variant="secondary"
                              size="sm"
                              class="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                              onClick={() => onTogglePlan("paid")}
                            >
                              ✓ Converter em Plano Pago
                            </Button>
                          }
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            class="w-full text-slate-600"
                            onClick={() => onTogglePlan("trial")}
                          >
                            Voltar para Trial (14 dias)
                          </Button>
                        </Show>
                      </div>
                    </div>

                    <form onSubmit={onUpdateLimits} class="border-t border-slate-100 pt-4 space-y-2">
                      <Field
                        label="Atualizar Limite de Colaboradores"
                        name="maxUsers"
                        type="number"
                        value={newLimit() || String(current().org.maxUsers)}
                        onInput={(e) => setNewLimit(e.currentTarget.value)}
                      />
                      <Button type="submit" variant="secondary" size="sm" class="w-full">
                        {i18n.t("common.save")}
                      </Button>
                    </form>

                    <div class="border-t border-slate-100 pt-4 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold text-slate-900">Plano Comercial</span>
                        <A href="/4dm1n/planos" class="text-[11px] font-medium text-indigo-600 hover:underline">
                          Gerenciar planos
                        </A>
                      </div>

                      <div class="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        <div class="flex items-center justify-between">
                          <span>Mensalidade atual</span>
                          <strong class="text-slate-900">{formatBRL(computePlanMonthlyCents(current().org, currentPlan()))} / mês</strong>
                        </div>
                        <div class="mt-0.5 text-slate-500">
                          {currentPlan()
                            ? `${currentPlan()!.name} · ${
                                currentPlan()!.pricingMode === "package"
                                  ? `pacote de ${currentPlan()!.includedUsers ?? 0} usuários`
                                  : `${formatBRL(currentPlan()!.priceCents)} por usuário`
                              }`
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
                        <For each={plans() ?? []}>
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
                    Colaboradores da Empresa ({current().users.length} / {current().org.maxUsers})
                  </h2>
                </div>

                <Show when={current().users.length > 0} fallback={<EmptyState>Nenhum colaborador encontrado para esta empresa.</EmptyState>}>
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
