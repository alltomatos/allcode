import { A, createAsync } from "@solidjs/router"
import { Show } from "solid-js"
import { Logo } from "~/components/shell"
import { useI18n } from "~/i18n"
import { me, getSettings } from "~/lib/actions"
import { formatDate } from "~/lib/labels"

export default function TrialNoticePage() {
  const i18n = useI18n()
  const user = createAsync(() => me())
  const org = createAsync(() => getSettings())

  return (
    <div class="min-h-screen bg-slate-50 flex flex-col">
      <header class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 border-b border-slate-200 bg-white">
        <A href="/" class="flex items-center gap-2">
          <Logo />
        </A>
        <div class="flex items-center gap-3">
          <form method="post" action="/api/logout">
            <button
              type="submit"
              class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              {i18n.t("nav.logout")}
            </button>
          </form>
        </div>
      </header>

      <main class="flex-1 flex items-center justify-center p-6">
        <div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 text-center">
          <div class="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-amber-50 text-3xl ring-1 ring-amber-200">
            ⏳
          </div>

          <h1 class="text-xl font-bold tracking-tight text-slate-900">
            Período de Testes Expirado
          </h1>

          <p class="mt-2 text-sm text-slate-600 leading-relaxed">
            O período de avaliação gratuita da empresa{" "}
            <strong class="font-semibold text-slate-900">{org()?.name || "sua empresa"}</strong> chegou ao fim.
          </p>

          <Show when={org()?.trialEndsAt}>
            <div class="mt-4 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 ring-1 ring-amber-200/60">
              Expiração registrada em:{" "}
              <span class="font-semibold">
                {formatDate(org()?.trialEndsAt, i18n.locale())}
              </span>
            </div>
          </Show>

          <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-xs space-y-2">
            <div class="font-semibold text-slate-900">Como reativar o acesso?</div>
            <p class="text-slate-600">
              Para desbloquear o acesso de todos os colaboradores e migrar para um plano definitivo, entre em contato
              com o seu representante de vendas, revendedor autorizado ou suporte comercial:
            </p>
            <div class="pt-2 font-mono text-[11px] text-slate-700">
              E-mail: <a href="mailto:comercial@allcode.dev" class="text-indigo-600 hover:underline">comercial@allcode.dev</a>
            </div>
            <Show when={org()?.contactEmail}>
              <div class="font-mono text-[11px] text-slate-700">
                Contato da Empresa: {org()?.contactEmail}
              </div>
            </Show>
          </div>

          <Show when={user()?.isPlatformAdmin}>
            <div class="mt-6 border-t border-slate-100 pt-4">
              <A
                href="/4dm1n"
                class="inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Painel Super Admin (Prorrogar ou Reativar Empresa) →
              </A>
            </div>
          </Show>

          <div class="mt-6">
            <form method="post" action="/api/logout">
              <button
                type="submit"
                class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 cursor-pointer"
              >
                Encerrar Sessão
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
