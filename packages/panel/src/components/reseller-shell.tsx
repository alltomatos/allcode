import { A, useLocation } from "@solidjs/router"
import { For, Show, type ParentProps } from "solid-js"
import { useI18n, locales, type Locale } from "~/i18n"
import { initials } from "~/lib/labels"
import type { PublicUser } from "~/lib/actions"
import { Badge, cx } from "./ui"

export function ResellerShell(props: ParentProps<{ user: PublicUser; resellerName?: string; commissionRate?: number }>) {
  const i18n = useI18n()
  const location = useLocation()

  return (
    <div class="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_1fr]">
      <aside class="flex flex-col border-b border-slate-200 bg-emerald-950 text-white lg:min-h-screen lg:border-r lg:border-b-0">
        <div class="flex h-16 items-center justify-between px-5 border-b border-emerald-900">
          <A href="/revenda" class="flex items-center gap-2">
            <span class="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-slate-950 shadow-xs">
              🤝
            </span>
            <div class="min-w-0">
              <span class="block text-xs font-bold tracking-tight text-white leading-tight">Painel da Revenda</span>
              <span class="block text-[11px] text-emerald-400 font-medium truncate">
                {props.resellerName ?? "Parceiro AllCode"}
              </span>
            </div>
          </A>
          <span class="rounded bg-emerald-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            PARCEIRO
          </span>
        </div>

        <div class="p-3">
          <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 px-3 py-1">
            Menu da Revenda
          </div>
          <nav class="flex flex-col gap-1 mt-1">
            <A
              href="/revenda"
              class={cx(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                location.pathname === "/revenda" || location.pathname === "/revenda/"
                  ? "bg-emerald-900 text-white shadow-xs"
                  : "text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white",
              )}
            >
              📊 Indicadores & Clientes
            </A>
            <A
              href="/revenda/novo"
              class={cx(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                location.pathname === "/revenda/novo"
                  ? "bg-emerald-900 text-white shadow-xs"
                  : "text-emerald-100/80 hover:bg-emerald-900/50 hover:text-white",
              )}
            >
              ➕ Nova Empresa Cliente
            </A>
            <div class="my-2 border-t border-emerald-900/60" />
            <A
              href="/app"
              class="rounded-lg px-3 py-2 text-sm font-medium text-emerald-300/70 hover:bg-emerald-900/50 hover:text-white transition"
            >
              ← Painel da Minha Empresa
            </A>
          </nav>
        </div>

        <Show when={props.commissionRate !== undefined}>
          <div class="mx-3 mt-1 rounded-xl bg-emerald-900/40 p-3 ring-1 ring-emerald-800/60 text-xs">
            <div class="text-emerald-400 font-medium text-[11px] uppercase tracking-wider">Sua Comissão Padrão</div>
            <div class="mt-0.5 text-base font-bold text-white">
              {(props.commissionRate! * 100).toFixed(0)}% <span class="text-xs font-normal text-emerald-300">sobre licenças</span>
            </div>
          </div>
        </Show>

        <div class="mt-auto border-t border-emerald-900 p-4">
          <div class="flex items-center gap-3">
            <span class="grid h-9 w-9 place-items-center rounded-full bg-emerald-900 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-800">
              {initials(props.user.name)}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-white">{props.user.name}</div>
              <div class="truncate text-xs text-emerald-300/70">{props.user.email}</div>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between gap-2">
            <Badge tone="brand">Revendedor</Badge>
            <form method="post" action="/api/logout">
              <button type="submit" class="text-xs font-medium text-emerald-300 hover:text-white cursor-pointer">
                {i18n.t("nav.logout")}
              </button>
            </form>
          </div>
          <div class="mt-4 flex items-center gap-1.5 border-t border-emerald-900/80 pt-3 text-xs">
            <span class="mr-1 text-[11px] text-emerald-400 font-medium">{i18n.t("common.language")}:</span>
            <For each={locales}>
              {(locale) => (
                <button
                  type="button"
                  onClick={() => i18n.setLocale(locale)}
                  class={cx(
                    "rounded px-2 py-0.5 font-semibold transition cursor-pointer text-xs",
                    locale === i18n.locale()
                      ? "bg-emerald-600 text-white"
                      : "text-emerald-300/70 hover:bg-emerald-900 hover:text-white",
                  )}
                >
                  {label(locale)}
                </button>
              )}
            </For>
          </div>
        </div>
      </aside>

      <main class="min-w-0 p-6 lg:p-10">
        <div class="mx-auto w-full max-w-6xl">{props.children}</div>
      </main>
    </div>
  )
}

function label(locale: Locale) {
  if (locale === "pt-BR") return "PT-BR"
  if (locale === "pt-PT") return "PT-PT"
  if (locale === "es") return "ES"
  return "EN"
}
