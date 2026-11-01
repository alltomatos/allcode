import { A, createAsync, revalidate, useAction } from "@solidjs/router"
import { For, Show, createSignal } from "solid-js"
import { Badge, Button, Card, EmptyState, Field, PageHeader } from "~/components/ui"
import { useI18n } from "~/i18n"
import { createReseller, listResellers } from "~/lib/actions"
import { formatDate } from "~/lib/labels"

export default function PlatformResellersPage() {
  const i18n = useI18n()
  const resellers = createAsync(() => listResellers())
  const create = useAction(createReseller)
  const [showModal, setShowModal] = createSignal(false)
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [issued, setIssued] = createSignal<{
    resellerName: string
    contactEmail: string
    tempPassword?: string
  } | null>(null)
  const [copied, setCopied] = createSignal(false)

  async function onSubmit(e: SubmitEvent) {
    e.preventDefault()
    const form = e.currentTarget as HTMLFormElement
    setPending(true)
    setError(null)
    const res = await create(new FormData(form))
    setPending(false)
    if (res?.error) {
      if (res.error === "admin.resellers.error.nameRequired") setError("Informe o nome da revenda.")
      else if (res.error === "admin.resellers.error.slugRequired") setError("Informe o slug da revenda.")
      else if (res.error === "admin.resellers.error.slugTaken") setError("Já existe uma revenda com este identificador.")
      else if (res.error === "users.new.error.emailTaken") setError("Este e-mail já está em uso.")
      else if (res.error === "users.new.error.invalidEmail") setError("E-mail de contato inválido.")
      else setError("Erro ao cadastrar revendedor.")
      return
    }
    if (res?.resellerId) {
      setIssued({
        resellerName: res.resellerName,
        contactEmail: res.contactEmail,
        tempPassword: res.tempPassword,
      })
      form.reset()
      revalidate("panel.admin.resellers.list")
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
        title="Gestão de Revendedores (Parceiros Comerciais)"
        subtitle="Gerencie revendas parceiras que provisionam e administram empresas clientes."
        actions={
          <div class="flex items-center gap-3">
            <A href="/4dm1n" class="text-sm font-medium text-slate-600 hover:text-slate-900">
              ← Gestão de Empresas
            </A>
            <Button onClick={() => { setShowModal(true); setIssued(null); setError(null) }}>
              + Novo Revendedor
            </Button>
          </div>
        }
      />

      <Show when={showModal()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 class="text-base font-bold text-slate-900">Cadastrar Novo Revendedor</h2>
              <button
                type="button"
                class="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <Show
              when={issued()}
              fallback={
                <form onSubmit={onSubmit} class="space-y-4">
                  <Field label="Nome da Revenda / Empresa Parceira" name="name" required placeholder="Ex: Alfa Soluções Digitais" />
                  <Field label="Identificador único (slug)" name="slug" required placeholder="alfa-solucoes" hint="Usado para identificação da revenda." />
                  <div class="grid gap-3 sm:grid-cols-2">
                    <Field label="Nome do Responsável" name="contactName" placeholder="Ex: Roberto Silva" />
                    <Field label="Comissão Padrão (%)" name="commissionRate" type="number" value="20" required hint="Percentual de comissão sobre a receita das empresas." />
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <Field label="E-mail de Acesso do Revendedor" name="contactEmail" type="email" required placeholder="roberto@alfasolucoes.com.br" />
                    <Field label="Telefone / WhatsApp" name="contactPhone" placeholder="(11) 99999-9999" />
                  </div>

                  <Show when={error()}>
                    <div class="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
                      {error()}
                    </div>
                  </Show>

                  <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={pending()}>
                      {pending() ? "Criando..." : "Salvar Revendedor"}
                    </Button>
                  </div>
                </form>
              }
            >
              {(res) => (
                <div class="space-y-4">
                  <div class="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200 text-xs text-emerald-950">
                    <div class="font-bold text-sm mb-1">🎉 Revendedor Cadastrado com Sucesso!</div>
                    <p>O acesso ao Painel da Revenda foi gerado. Entregue os dados com segurança ao parceiro:</p>
                    <div class="mt-3 space-y-1.5 font-mono text-xs bg-white p-3 rounded-lg border border-emerald-200">
                      <div>Revenda: <strong>{res().resellerName}</strong></div>
                      <div>Login: <strong>{res().contactEmail}</strong></div>
                      <div class="flex items-center gap-2 pt-1">
                        <span>Senha: <code>{res().tempPassword}</code></span>
                        <button
                          type="button"
                          onClick={copyPassword}
                          class="text-indigo-600 hover:underline font-sans font-semibold cursor-pointer"
                        >
                          {copied() ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button type="button" class="w-full" onClick={() => setShowModal(false)}>
                    Concluir
                  </Button>
                </div>
              )}
            </Show>
          </div>
        </div>
      </Show>

      <Show when={(resellers() ?? []).length > 0} fallback={<EmptyState>Nenhum revendedor cadastrado até o momento.</EmptyState>}>
        <div class="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th class="px-4 py-3">Revenda</th>
                <th class="px-4 py-3">Responsável</th>
                <th class="px-4 py-3">Comissão</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3">Cadastrado em</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <For each={resellers() ?? []}>
                {(r) => (
                  <tr class="hover:bg-slate-50 transition">
                    <td class="px-4 py-3">
                      <div class="font-semibold text-slate-900">{r.name}</div>
                      <div class="font-mono text-xs text-slate-500">{r.slug}</div>
                    </td>
                    <td class="px-4 py-3 text-xs">
                      <div class="font-medium text-slate-800">{r.contactName || "—"}</div>
                      <div class="text-slate-500">{r.contactEmail}</div>
                      <Show when={r.contactPhone}>
                        <div class="text-slate-400">{r.contactPhone}</div>
                      </Show>
                    </td>
                    <td class="px-4 py-3 text-xs font-semibold text-slate-900">
                      {(r.commissionRate * 100).toFixed(0)}%
                    </td>
                    <td class="px-4 py-3">
                      <Badge tone={r.status === "active" ? "success" : "danger"}>
                        {r.status === "active" ? "Ativo" : "Suspenso"}
                      </Badge>
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-500">
                      {formatDate(r.createdAt, i18n.locale())}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  )
}
