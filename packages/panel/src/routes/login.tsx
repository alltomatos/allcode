import { A, createAsync, useAction, useNavigate } from "@solidjs/router"
import { For, Show, createEffect, createSignal } from "solid-js"
import { Logo } from "~/components/shell"
import { Button, Field } from "~/components/ui"
import { locales, useI18n, type Locale } from "~/i18n"
import { login, me } from "~/lib/actions"

function short(locale: Locale) {
  if (locale === "pt-BR") return "PT-BR"
  if (locale === "pt-PT") return "PT-PT"
  if (locale === "es") return "ES"
  return "EN"
}

export default function LoginPage() {
  const i18n = useI18n()
  const navigate = useNavigate()
  const current = createAsync(() => me())
  const signIn = useAction(login)
  const [error, setError] = createSignal<string | null>(null)
  const [pending, setPending] = createSignal(false)

  createEffect(() => {
    if (current()) navigate("/app", { replace: true })
  })

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    setPending(true)
    setError(null)
    const result = await signIn(new FormData(form))
    setPending(false)
    if (result?.error) setError(i18n.t(result.error))
  }

  return (
    <div class="min-h-screen bg-slate-50">
      <header class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <A href="/" class="flex items-center gap-2">
          <Logo />
        </A>
        <div class="flex items-center gap-4">
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
          <A href="/" class="text-sm font-medium text-slate-600 hover:text-slate-900">
            {i18n.t("nav.backToSite")}
          </A>
        </div>
      </header>

      <main class="mx-auto w-full max-w-md px-6 pt-10 pb-16">
        <div class="rounded-2xl bg-white p-8 ring-1 ring-slate-200">
          <h1 class="text-xl font-semibold tracking-tight text-slate-900">{i18n.t("login.title")}</h1>
          <p class="mt-1 text-sm text-slate-600">{i18n.t("login.subtitle")}</p>

          <Show when={error()}>
            <div class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error()}
            </div>
          </Show>

          <form onSubmit={submit} class="mt-6 space-y-4">
            <Field
              label={i18n.t("login.email")}
              name="email"
              type="email"
              autocomplete="username"
              required
              placeholder="voce@empresa.com"
            />
            <Field
              label={i18n.t("login.password")}
              name="password"
              type="password"
              autocomplete="current-password"
              required
            />
            <Button type="submit" class="w-full" disabled={pending()}>
              {pending() ? i18n.t("common.loading") : i18n.t("login.submit")}
            </Button>
          </form>

          <div class="mt-4 flex items-center justify-between text-sm">
            <A href="/recuperar-senha" class="font-medium text-indigo-600 hover:text-indigo-500">
              {i18n.t("login.forgot")}
            </A>
          </div>
        </div>

        <Show when={import.meta.env.DEV}>
          <div class="mt-6 rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500">
            <div class="font-medium text-slate-600">{i18n.t("login.demo")}</div>
            <div class="mt-1 font-mono">admin@allcode.dev / allcode123</div>
          </div>
        </Show>
      </main>
    </div>
  )
}
