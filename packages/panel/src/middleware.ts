import { createMiddleware } from "@solidjs/start/middleware"
import { redirect } from "@solidjs/router"
import { currentUser } from "./lib/auth"
import { store, isTrialExpired } from "./lib/store"

export default createMiddleware({
  async onRequest(event) {
    const url = new URL(event.request.url)
    const isApp = url.pathname.startsWith("/app")
    const isAdmin = url.pathname.startsWith("/4dm1n")
    const isReseller = url.pathname.startsWith("/revenda")

    if (!isApp && !isAdmin && !isReseller) return

    const user = await currentUser()
    if (!user) return redirect("/login")

    if (isAdmin && !user.isPlatformAdmin) {
      return redirect("/app")
    }

    if (isReseller && !user.isReseller && !user.isPlatformAdmin) {
      return redirect("/app")
    }

    if (isApp && !user.isPlatformAdmin) {
      const db = store()
      const org = await db.org.get(user.orgID)
      if (org.status === "suspended" || isTrialExpired(org)) {
        return redirect("/aviso-trial")
      }
    }
  },
})
