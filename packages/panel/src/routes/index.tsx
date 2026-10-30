import { A } from "@solidjs/router"
import { For } from "solid-js"
import { Logo } from "~/components/shell"
import { useI18n, locales, type Locale } from "~/i18n"

const features = [
  { title: "landing.feature.access.title", body: "landing.feature.access.body" },
  { title: "landing.feature.audit.title", body: "landing.feature.audit.body" },
  { title: "landing.feature.sso.title", body: "landing.feature.sso.body" },
  { title: "landing.feature.desktop.title", body: "landing.feature.desktop.body" },
] as const

const steps = [
  { title: "landing.how.step1.title", body: "landing.how.step1.body" },
  { title: "landing.how.step2.title", body: "landing.how.step2.body" },
  { title: "landing.how.step3.title", body: "landing.how.step3.body" },
] as const

export default function LandingPage() {
  const i18n = useI18n()

  return (
    <div class="min-h-screen bg-slate-50">
      <header class="sticky top-0 z-10 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur">
        <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <A href="/" class="flex items-center gap-2">
            <Logo />
            <span class="ml-1 text-sm font-medium text-slate-500">{i18n.t("landing.hero.badge")}</span>
          </A>
          <nav class="flex items-center gap-3">
            <div class="flex items-center gap-1 rounded-lg bg-slate-200/50 p-1">
              <For each={locales}>
                {(locale) => (
                  <button
                    type="button"
                    onClick={() => i18n.setLocale(locale)}
                    class={`rounded px-2 py-0.5 text-xs font-semibold transition cursor-pointer ${
                      locale === i18n.locale()
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {short(locale)}
                  </button>
                )}
              </For>
            </div>
            <A
              href="/login"
              class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {i18n.t("landing.nav.login")}
            </A>
          </nav>
        </div>
      </header>

      <main>
        <section class="mx-auto w-full max-w-6xl px-6 pt-16 pb-20 sm:pt-24">
          <div class="mx-auto max-w-3xl text-center">
            <span class="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100 ring-inset">
              {i18n.t("landing.hero.badge")}
            </span>
            <h1 class="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              {i18n.t("landing.hero.title")}
            </h1>
            <p class="mx-auto mt-5 max-w-2xl text-lg text-slate-600">{i18n.t("landing.hero.subtitle")}</p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
              <A
                href="/login"
                class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                {i18n.t("landing.hero.cta")}
              </A>
              <a
                href="mailto:vendas@alltomatos.com"
                class="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50"
              >
                {i18n.t("landing.hero.secondary")}
              </a>
            </div>
          </div>
        </section>

        <section class="border-y border-slate-200 bg-white py-16">
          <div class="mx-auto grid w-full max-w-6xl gap-6 px-6 sm:grid-cols-2">
            <For each={features}>
              {(feature) => (
                <div class="rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
                  <h2 class="text-base font-semibold text-slate-900">{i18n.t(feature.title)}</h2>
                  <p class="mt-2 text-sm text-slate-600">{i18n.t(feature.body)}</p>
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 class="text-center text-2xl font-semibold tracking-tight text-slate-900">{i18n.t("landing.how.title")}</h2>
          <div class="mt-10 grid gap-6 sm:grid-cols-3">
            <For each={steps}>
              {(step, index) => (
                <div class="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                  <span class="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {index() + 1}
                  </span>
                  <h3 class="mt-4 text-sm font-semibold text-slate-900">{i18n.t(step.title)}</h3>
                  <p class="mt-2 text-sm text-slate-600">{i18n.t(step.body)}</p>
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="border-t border-slate-200 bg-white py-16">
          <div class="mx-auto w-full max-w-6xl px-6">
            <div class="rounded-2xl bg-slate-900 px-8 py-10 sm:flex sm:items-center sm:justify-between">
              <div>
                <h2 class="text-xl font-semibold text-white">{i18n.t("landing.feature.desktop.title")}</h2>
                <p class="mt-2 max-w-xl text-sm text-slate-300">{i18n.t("landing.feature.desktop.body")}</p>
              </div>
              <A
                href="/login"
                class="mt-6 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-slate-900 sm:mt-0"
              >
                {i18n.t("landing.hero.cta")}
              </A>
            </div>
          </div>
        </section>
      </main>

      <footer class="border-t border-slate-200 py-8">
        <div class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-slate-500">
          <span>
            © {new Date().getFullYear()} Alltomatos. {i18n.t("landing.footer.rights")}
          </span>
          <span>allcode.alltomatos.dev.br</span>
        </div>
      </footer>
    </div>
  )
}

function short(locale: Locale) {
  if (locale === "pt-BR") return "PT-BR"
  if (locale === "pt-PT") return "PT-PT"
  if (locale === "es") return "ES"
  return "EN"
}
