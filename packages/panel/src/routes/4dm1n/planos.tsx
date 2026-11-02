import { A, createAsync, revalidate, useAction } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, StatGrid } from "~/components/ui"
import { createPlan, listPlans, removePlan, setPlanActive, updatePlan } from "~/lib/actions"
import { formatBRL } from "~/lib/labels"
import type { Plan } from "~/lib/store"

type PlanDraft = {
  name: string
  slug: string
  description?: string
  pricingMode: "per_user" | "package"
  price: string
  includedUsers: string
  extraUserPrice: string
  minUsers: string
  maxUsers: string
  sortOrder: string
  isActive: boolean
}

function emptyDraft(): PlanDraft {
  return {
    name: "",
    slug: "",
    description: "",
    pricingMode: "per_user",
    price: "65,00",
    includedUsers: "10",
    extraUserPrice: "",
    minUsers: "1",
    maxUsers: "",
    sortOrder: "0",
    isActive: true,
  }
}

function draftFromPlan(plan: Plan): PlanDraft {
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? "",
    pricingMode: plan.pricingMode,
    price: (plan.priceCents / 100).toFixed(2).replace(".", ","),
    includedUsers: String(plan.includedUsers ?? 10),
    extraUserPrice: plan.extraUserPriceCents ? (plan.extraUserPriceCents / 100).toFixed(2).replace(".", ",") : "",
    minUsers: String(plan.minUsers),
    maxUsers: plan.maxUsers ? String(plan.maxUsers) : "",
    sortOrder: String(plan.sortOrder),
    isActive: plan.isActive,
  }
}

export default function PlansPage() {
  const plans = createAsync(() => listPlans(false))
  const create = useAction(createPlan)
  const update = useAction(updatePlan)
  const toggle = useAction(setPlanActive)
  const remove = useAction(removePlan)

  const [editing, setEditing] = createSignal<string | null>(null)
  const [showForm, setShowForm] = createSignal(false)
  const [draft, setDraft] = createSignal<PlanDraft>(emptyDraft())
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  function openCreate() {
    setDraft(emptyDraft())
    setEditing(null)
    setError(null)
    setShowForm(true)
  }

  function openEdit(plan: Plan) {
    setDraft(draftFromPlan(plan))
    setEditing(plan.id)
    setError(null)
    setShowForm(true)
  }

  function onNameInput(value: string) {
    setDraft((current) => ({
      ...current,
      name: value,
      slug: current.slug || value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"),
    }))
  }

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    const formData = new FormData(form)
    setPending(true)
    setError(null)

    const res = editing() ? await update(editing()!, formData) : await create(formData)
    setPending(false)

    if (res?.error) {
      setError(errorMessage(res.error))
      return
    }

    revalidate("panel.plans")
    revalidate("panel.admin.stats")
    setShowForm(false)
    setEditing(null)
    setDraft(emptyDraft())
  }

  async function onToggle(plan: Plan) {
    await toggle(plan.id, !plan.isActive)
    revalidate("panel.plans")
  }

  async function onRemove(plan: Plan) {
    if (!confirm(`Remover o plano "${plan.name}"? Empresas usando este plano voltam ao preço padrão por assento.`)) return
    await remove(plan.id)
    revalidate("panel.plans")
    revalidate("panel.admin.tenants")
  }

  const stats = () => {
    const list = plans() ?? []
    return {
      total: list.length,
      active: list.filter((p) => p.isActive).length,
      perUser: list.filter((p) => p.pricingMode === "per_user" && p.isActive).length,
      packages: list.filter((p) => p.pricingMode === "package" && p.isActive).length,
    }
  }

  return (
    <div>
      <PageHeader
        title="Planos e Preços"
        subtitle="Defina o valor por usuário, crie pacotes fechados e controle quais planos podem ser vendidos."
        actions={
          <div class="flex items-center gap-3">
            <A href="/4dm1n" class="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Gestão de Empresas
            </A>
            <Button onClick={openCreate}>+ Novo Plano</Button>
          </div>
        }
      />

      <div class="mb-8">
        <StatGrid
          items={[
            { label: "Planos cadastrados", value: stats().total },
            { label: "Planos ativos", value: stats().active },
            { label: "Por usuário", value: stats().perUser },
            { label: "Pacotes fechados", value: stats().packages },
          ]}
        />
      </div>

      <Show when={showForm()}>
        <Card class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-900">
              {editing() ? "Editar plano" : "Cadastrar novo plano"}
            </h2>
            <button
              type="button"
              class="text-xs font-medium text-slate-400 hover:text-slate-700 cursor-pointer"
              onClick={() => setShowForm(false)}
            >
              Fechar ✕
            </button>
          </div>

          <form onSubmit={onSubmit} class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nome do plano"
                name="name"
                required
                value={draft().name}
                onInput={(e) => onNameInput(e.currentTarget.value)}
                placeholder="Ex: Licença Corporativa"
              />
              <Field
                label="Identificador (slug)"
                name="slug"
                required
                value={draft().slug}
                onInput={(e) => setDraft((d) => ({ ...d, slug: e.currentTarget.value }))}
                placeholder="licenca-corporativa"
              />
            </div>

            <Field
              label="Descrição (opcional)"
              name="description"
              value={draft().description ?? ""}
              onInput={(e) => setDraft((d) => ({ ...d, description: e.currentTarget.value }))}
              placeholder="O que está incluso neste plano"
            />

            <div class="grid gap-4 sm:grid-cols-2">
              <Select
                label="Modelo de cobrança"
                name="pricingMode"
                value={draft().pricingMode}
                onSelect={(value) =>
                  setDraft((d) => ({ ...d, pricingMode: value === "package" ? "package" : "per_user" }))
                }
              >
                <option value="per_user">Por usuário / mês</option>
                <option value="package">Pacote fechado</option>
              </Select>

              <Field
                label={draft().pricingMode === "package" ? "Valor do pacote (R$ / mês)" : "Valor por usuário (R$ / mês)"}
                name="price"
                required
                value={draft().price}
                onInput={(e) => setDraft((d) => ({ ...d, price: e.currentTarget.value }))}
                placeholder="65,00"
                hint="Aceita 65, 65,00 ou 1.234,56."
              />
            </div>

            <Show when={draft().pricingMode === "package"}>
              <div class="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Usuários inclusos no pacote"
                  name="includedUsers"
                  type="number"
                  value={draft().includedUsers}
                  onInput={(e) => setDraft((d) => ({ ...d, includedUsers: e.currentTarget.value }))}
                />
                <Field
                  label="Valor por usuário extra (R$)"
                  name="extraUserPrice"
                  value={draft().extraUserPrice}
                  onInput={(e) => setDraft((d) => ({ ...d, extraUserPrice: e.currentTarget.value }))}
                  placeholder="65,00"
                  hint="Deixe em branco para não cobrar assentos além do pacote."
                />
              </div>
            </Show>

            <div class="grid gap-4 sm:grid-cols-3">
              <Field
                label="Mínimo de usuários"
                name="minUsers"
                type="number"
                value={draft().minUsers}
                onInput={(e) => setDraft((d) => ({ ...d, minUsers: e.currentTarget.value }))}
              />
              <Field
                label="Máximo de usuários"
                name="maxUsers"
                type="number"
                value={draft().maxUsers}
                onInput={(e) => setDraft((d) => ({ ...d, maxUsers: e.currentTarget.value }))}
                placeholder="Sem limite"
              />
              <Field
                label="Ordem de exibição"
                name="sortOrder"
                type="number"
                value={draft().sortOrder}
                onInput={(e) => setDraft((d) => ({ ...d, sortOrder: e.currentTarget.value }))}
              />
            </div>

            <label class="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                name="isActive"
                checked={draft().isActive}
                onChange={(e) => setDraft((d) => ({ ...d, isActive: e.currentTarget.checked }))}
                class="size-4 rounded"
              />
              Plano disponível para venda
            </label>

            <Show when={error()}>
              <div class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{error()}</div>
            </Show>

            <div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending()}>
                {pending() ? "Salvando..." : editing() ? "Salvar alterações" : "Criar plano"}
              </Button>
            </div>
          </form>
        </Card>
      </Show>

      <Show
        when={(plans() ?? []).length > 0}
        fallback={<EmptyState>Nenhum plano cadastrado. Crie o primeiro para definir o valor por usuário.</EmptyState>}
      >
        <div class="grid gap-4 md:grid-cols-2">
          <For each={plans() ?? []}>
            {(plan) => (
              <Card>
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-sm font-bold text-slate-900">{plan.name}</h3>
                      <Badge tone={plan.isActive ? "success" : "neutral"}>
                        {plan.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge tone="brand">
                        {plan.pricingMode === "package" ? "Pacote" : "Por usuário"}
                      </Badge>
                    </div>
                    <Show when={plan.description}>
                      <p class="mt-1 text-xs text-slate-500">{plan.description}</p>
                    </Show>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-bold text-slate-900">{formatBRL(plan.priceCents)}</div>
                    <div class="text-[11px] text-slate-500">
                      {plan.pricingMode === "package"
                        ? `por pacote · ${plan.includedUsers ?? 0} usuários`
                        : "por usuário / mês"}
                    </div>
                  </div>
                </div>

                <dl class="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-[11px]">
                  <div>
                    <dt class="text-slate-500">Mín. usuários</dt>
                    <dd class="font-semibold text-slate-800">{plan.minUsers}</dd>
                  </div>
                  <div>
                    <dt class="text-slate-500">Máx. usuários</dt>
                    <dd class="font-semibold text-slate-800">{plan.maxUsers ?? "—"}</dd>
                  </div>
                  <div>
                    <dt class="text-slate-500">Extra por assento</dt>
                    <dd class="font-semibold text-slate-800">
                      {plan.extraUserPriceCents ? formatBRL(plan.extraUserPriceCents) : "—"}
                    </dd>
                  </div>
                </dl>

                <div class="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                    onClick={() => openEdit(plan)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                    onClick={() => onToggle(plan)}
                  >
                    {plan.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                    onClick={() => onRemove(plan)}
                  >
                    Remover
                  </button>
                </div>
              </Card>
            )}
          </For>
        </div>
      </Show>

      <div class="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Como o valor é calculado</h3>
        <ul class="mt-2 space-y-1 text-xs text-slate-600">
          <li>
            <strong>Por usuário:</strong> valor mensal × limite de assentos da empresa. Ex.: R$ 65,00 × 15 = R$ 975,00.
          </li>
          <li>
            <strong>Pacote fechado:</strong> valor fixo do pacote + assentos excedentes × valor do usuário extra.
          </li>
          <li>
            Empresas sem plano atribuído usam o preço padrão de {formatBRL(5000)} por assento.
          </li>
        </ul>
      </div>
    </div>
  )
}

function errorMessage(code: string): string {
  if (code === "admin.plans.error.nameRequired") return "Informe o nome do plano."
  if (code === "admin.plans.error.slugRequired") return "Informe o identificador do plano."
  if (code === "admin.plans.error.slugTaken") return "Já existe um plano com este identificador."
  if (code === "admin.plans.error.priceRequired") return "Informe um valor maior que zero."
  if (code === "admin.plans.error.notFound") return "Plano não encontrado."
  return "Não foi possível salvar o plano."
}
