import { useSession } from "@solidjs/start/http"
import { env } from "./env"

export type PanelSession = {
  userID?: string
}

const password = env("PANEL_SESSION_SECRET", "panel-dev-session-secret-change-me-0123456789abcdef")

export function usePanelSession() {
  return useSession<PanelSession>({
    password,
    name: "panel_session",
    maxAge: 60 * 60 * 12,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  })
}
