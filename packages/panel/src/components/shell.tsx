import { A, useLocation } from "@solidjs/router"
import { For, Show, type ParentProps } from "solid-js"
import { useI18n, locales, type Locale } from "~/i18n"
import { logout } from "~/lib/actions"
import { initials, roleKey } from "~/lib/labels"
import type { PublicUser } from "~/lib/actions"
import { Badge, cx } from "./ui"

const navItems = [
  { href: "/app", label: "nav.overview" },
  { href: "/app/usuarios", label: "nav.users" },
  { href: "/app/auditoria", label: "nav.audit" },
  { href: "/app/configuracoes", label: "nav.settings" },
] as const

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app" || pathname === "/app/"
  return pathname.startsWith(href)
}

export function Logo(props: { compact?: boolean }) {
  return (
    <div class="flex items-center gap-2.5">
      <span class="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">A</span>
      <Show when={!props.compact}>
        <span class="text-sm font-semibold tracking-tight text-slate-900">AllCode</span>
      </Show>
    </div>
  )
}

export function Shell(props: ParentProps<{ user: PublicUser }>) {
  const i18n = useI18n()
  const location = useLocation()

  return (
    <div class="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[260px_1fr]">
      <aside class="flex flex-col border-b border-slate-200 bg-white lg:min-h-screen lg:border-r lg:border-b-0">
        <div class="flex h-16 items-center px-5">
          <A href="/" class="flex items-center gap-2">
            <Logo />
            <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Panel
            </span>
          </A>
        </div>

        <nav class="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          <For each={navItems}>
            {(item) => (
              <A
                href={item.href}
                class={cx(
                  "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                  isActive(location.pathname, item.href)
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {i18n.t(item.label)}
              </A>
            )}
          </For>

          <Show when={props.user.isPlatformAdmin}>
            <div class="my-2 border-t border-slate-100 hidden lg:block" />
            <A
              href="/4dm1n"
              class={cx(
                "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                location.pathname.startsWith("/4dm1n")
                  ? "bg-indigo-600 text-white"
                  : "text-indigo-600 hover:bg-indigo-50",
              )}
            >
              ★ {i18n.t("nav.adminArea")}
            </A>
          </Show>
        </nav>

        <div class="mt-auto hidden border-t border-slate-200 p-4 lg:block">
          <div class="flex items-center gap-3">
            <span class="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
              {initials(props.user.name)}
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-slate-900">{props.user.name}</div>
              <div class="truncate text-xs text-slate-500">{props.user.email}</div>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between gap-2">
            <Badge tone="brand">{i18n.t(roleKey(props.user.role))}</Badge>
            <form action={logout}>
              <button type="submit" class="text-xs font-medium text-slate-500 hover:text-slate-900">
                {i18n.t("nav.logout")}
              </button>
            </form>
          </div>
          <div class="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs">
            <span class="mr-1 text-[11px] text-slate-400 font-medium">{i18n.t("common.language")}:</span>
            <For each={locales}>
              {(locale) => (
                <button
                  type="button"
                  onClick={() => i18n.setLocale(locale)}
                  class={cx(
                    "rounded px-2 py-0.5 font-semibold transition cursor-pointer",
                    locale === i18n.locale() ? "bg-slate-900 text-white shadow-xs" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
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
