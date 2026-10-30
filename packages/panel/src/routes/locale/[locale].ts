import type { APIEvent } from "@solidjs/start"

export function GET(event: APIEvent) {
  const requested = event.params.locale
  const locale = requested === "en" || requested === "es" || requested === "pt-PT" || requested === "pt-BR" ? requested : "pt-BR"
  const referer = event.request.headers.get("referer")
  let target = "/"
  if (referer) {
    try {
      const url = new URL(referer)
      target = `${url.pathname}${url.search}`
    } catch {}
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: target,
      "set-cookie": `panel_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
    },
  })
}
