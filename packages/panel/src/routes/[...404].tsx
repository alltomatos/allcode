import { A } from "@solidjs/router"
import { Logo } from "~/components/shell"
import { useI18n } from "~/i18n"

export default function NotFound() {
  const i18n = useI18n()

  return (
    <div class="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div class="text-center">
        <div class="flex justify-center">
          <Logo />
        </div>
        <h1 class="mt-6 text-3xl font-bold tracking-tight text-slate-900">404</h1>
        <h2 class="mt-2 text-lg font-medium text-slate-800">{i18n.t("notfound.title")}</h2>
        <p class="mt-1 text-sm text-slate-600">{i18n.t("notfound.description")}</p>
        <A
          href="/"
          class="mt-6 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          {i18n.t("notfound.back")}
        </A>
      </div>
    </div>
  )
}
