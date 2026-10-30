import { createMiddleware } from "@solidjs/start/middleware"
import { redirect } from "@solidjs/router"
import { currentUser } from "./lib/auth"

export default createMiddleware({
  async onRequest(event) {
    const url = new URL(event.request.url)
    const isApp = url.pathname.startsWith("/app")
    const isAdmin = url.pathname.startsWith("/4dm1n")

    if (!isApp && !isAdmin) return

    const user = await currentUser()
    if (!user) return redirect("/login")

    if (isAdmin && !user.isPlatformAdmin) {
      return redirect("/app")
    }
  },
})
