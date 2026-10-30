// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server"
import { getRequestEvent } from "solid-js/web"

function readLocale(cookie: string | null, header: string | null) {
  const stored = cookie?.match(/(?:^|;\s*)panel_locale=([^;]+)/)?.[1]
  if (stored === "en" || stored === "es" || stored === "pt-BR" || stored === "pt-PT") return stored
  for (const item of header?.split(",") ?? []) {
    const value = item.trim().split(";")[0]?.toLowerCase()
    if (!value) continue
    if (value === "pt-pt") return "pt-PT"
    if (value.startsWith("es")) return "es"
    if (value.startsWith("en")) return "en"
  }
  return "pt-BR"
}

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => {
      const event = getRequestEvent()
      const lang = readLocale(event?.request.headers.get("cookie") ?? null, event?.request.headers.get("accept-language") ?? null)
      return (
        <html lang={lang}>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>AllCode</title>
            <meta name="description" content="Painel de administração AllCode" />
            <meta name="theme-color" content="#f8fafc" />
            <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
            <meta name="googlebot" content="noindex, nofollow" />
            {assets}
          </head>
          <body class="antialiased">
            <div id="app">{children}</div>
            {scripts}
          </body>
        </html>
      )
    }}
  />
))
