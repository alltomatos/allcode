import { Router } from "@solidjs/router"
import { FileRoutes } from "@solidjs/start/router"
import { MetaProvider } from "@solidjs/meta"
import { Suspense } from "solid-js"
import { getRequestEvent } from "solid-js/web"
import "./app.css"
import { I18nProvider, type Locale } from "~/i18n"

function readLocale(): Locale {
  if (typeof document !== "undefined") {
    const value = document.documentElement.lang
    return value === "en" || value === "es" || value === "pt-PT" || value === "pt-BR" ? value : "pt-BR"
  }
  const event = getRequestEvent()
  const cookie = event?.request.headers.get("cookie") ?? ""
  const stored = cookie.match(/(?:^|;\s*)panel_locale=([^;]+)/)?.[1]
  if (stored === "en" || stored === "es" || stored === "pt-BR" || stored === "pt-PT") return stored
  for (const item of (event?.request.headers.get("accept-language") ?? "").split(",")) {
    const value = item.trim().split(";")[0]?.toLowerCase()
    if (!value) continue
    if (value === "pt-pt") return "pt-PT"
    if (value.startsWith("es")) return "es"
    if (value.startsWith("en")) return "en"
  }
  return "pt-BR"
}

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <I18nProvider locale={readLocale()}>
            <Suspense>{props.children}</Suspense>
          </I18nProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  )
}
