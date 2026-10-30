import { A } from "@solidjs/router"
import { Logo } from "~/components/shell"
import { Button, Field } from "~/components/ui"
import { useI18n } from "~/i18n"

export default function RecoverPasswordPage() {
  const i18n = useI18n()

  return (
    <div class="min-h-screen bg-slate-50">
      <header class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <A href="/" class="flex items-center gap-2">
          <Logo />
        </A>
        <A href="/login" class="text-sm font-medium text-slate-600 hover:text-slate-900">
          {i18n.t("login.submit")}
        </A>
      </header>

      <main class="mx-auto w-full max-w-md px-6 pt-10 pb-16">
        <div class="rounded-2xl bg-white p-8 ring-1 ring-slate-200">
          <h1 class="text-xl font-semibold tracking-tight text-slate-900">{i18n.t("login.forgot")}</h1>
          <p class="mt-1 text-sm text-slate-600">
            {i18n.t("login.recoverHelp")}
          </p>
          <form class="mt-6 space-y-4" onSubmit={(event) => event.preventDefault()}>
            <Field label={i18n.t("login.email")} name="email" type="email" autocomplete="username" required />
            <Button type="submit" class="w-full" disabled>
              {i18n.t("login.forgot")}
            </Button>
          </form>
          <p class="mt-4 text-xs text-slate-500">{i18n.t("login.recoverDisabled")}</p>
        </div>
      </main>
    </div>
  )
}
