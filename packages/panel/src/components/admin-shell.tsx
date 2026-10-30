import { A, useLocation } from "@solidjs/router"
import { For, Show, type ParentProps } from "solid-js"
import { useI18n, locales, type Locale } from "~/i18n"
import { logout } from "~/lib/actions"
import { initials } from "~/lib/labels"
import type { PublicUser } from "~/lib/actions"
import { Badge, cx } from "./ui"

export function AdminShell(props: ParentProps<{ user: PublicUser }>) {
  const i18n = useI18n()
  const location = useLocation()

  return (
    <div class="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_1fr]">
      <aside class="flex flex-col border-b border-slate-200 bg-slate-900 text-white lg:min-h-screen lg:border-r lg:border-b-0">
        <div class="flex h-16 items-center justify-between px-5 border-b border-slate-800">
          <A href="/4dm1n" class="flex items-center gap-2">
            <span class="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500 text-sm font-bold text-white shadow-xs">
              A
            </span>
            <span class="text-sm font-semibold tracking-tight text-white">AllCode Platform</span>
          </A>
          <span class="rounded bg-indigo-950 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 ring-1 ring-indigo-500/30">
            ROOT
          </span>
        </div>

        <div class="p-3">
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
            {i18n.t("admin.nav.title")}
          </div>
          <nav class="flex flex-col gap-1 mt-1">
            <A
              href="/4dm1n"
              class={cx(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                location.pathname === "/4dm1n" || location.pathname === "/4dm1n/"
                  ? "bg-slate-800 text-white shadow-xs"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
              )}
            >
              🏢 {i18n.t("admin.nav.tenants")}
            </A>
            <A
              href="/app"
              class="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-white transition"
            >
              ← {i18n.t("nav.overview")}
            </A>
          </nav>
        </div>

        <div class="mt-auto border-t border-slate-800 p-4">
          <div class="flex items-center gap-3">
            <span class="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-xs font-semibold text-indigo-300 ring-1 ring-slate-700">
              {initials(props.user.name)}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-white">{props.user.name}</div>
              <div class="truncate text-xs text-slate-400">{props.user.email}</div>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between gap-2">
            <Badge tone="brand">Super Admin</Badge>
            <form action={logout}>
              <button type="submit" class="text-xs font-medium text-slate-400 hover:text-white cursor-pointer">
                {i18n.t("nav.logout")}
              </button>
            </form>
          </div>
          <div class="mt-4 flex items-center gap-1.5 border-t border-slate-800/80 pt-3 text-xs">
            <span class="mr-1 text-[11px] text-slate-500 font-medium">{i18n.t("common.language")}:</span>
            <For each={locales}>
              {(locale) => (
                <button
                  type="button"
                  onClick={() => i18n.setLocale(locale)}
                  class={cx(
                    "rounded px-2 py-0.5 font-semibold transition cursor-pointer text-xs",
                    locale === i18n.locale()
                      ? "bg-indigo-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white",
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
