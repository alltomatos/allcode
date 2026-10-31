import type { APIEvent } from "@solidjs/start"

// Kept deliberately free of `usePanelSession()`: touching the session API inside
// this handler makes Solid Start re-issue a signed cookie, which would undo the
// clear below. Clearing the cookie by name is enough to sign the user out.
function clearSessionCookie(secure: boolean) {
  const flags = secure ? "; Secure" : ""
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT"
  return `panel_session=; Path=/; Max-Age=0; Expires=${expires}; HttpOnly; SameSite=Lax${flags}`
}

function logout(event: APIEvent) {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/login",
      "set-cookie": clearSessionCookie(event.request.url.startsWith("https:")),
      "cache-control": "no-store",
    },
  })
}

export async function POST(event: APIEvent) {
  return logout(event)
}

export async function GET(event: APIEvent) {
  return logout(event)
}
