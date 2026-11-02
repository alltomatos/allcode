import { Show, createMemo, createSignal } from "solid-js"
import { useTenantAuth } from "@/context/tenant-auth"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { Icon } from "@allcode/ui/icon"

const DEFAULT_AUTH_URL = "https://allcode.alltomatos.dev.br"
const BRAND = "#0f9d6e"
const BRAND_HOVER = "#12b47e"

export function DesktopLoginModal() {
  const tenantAuth = useTenantAuth()
  const language = useLanguage()
  const platform = usePlatform()

  const [email, setEmail] = createSignal(tenantAuth.store.lastEmail || "")
  const [password, setPassword] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [showPassword, setShowPassword] = createSignal(false)

  const tenant = () => tenantAuth.store.tenant
  const isRecognized = () => Boolean(tenant() && tenantAuth.store.lastEmail)

  const revokedCopy = createMemo(() => {
    const reason = tenantAuth.store.blockReason
    if (reason === "trial_expired") {
      return { title: "login.revoked.trial.title", body: "login.revoked.trial.body" } as const
    }
    if (reason === "tenant_suspended") {
      return { title: "login.revoked.companySuspended.title", body: "login.revoked.companySuspended.body" } as const
    }
    return { title: "login.revoked.title", body: "login.revoked.body" } as const
  })

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault()
    const mail = (isRecognized() ? tenantAuth.store.lastEmail : email())?.trim().toLowerCase() || ""
    const pass = password()

    if (!mail || !pass) {
      setError(language.t("login.error.required"))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${DEFAULT_AUTH_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: mail,
          password: pass,
          ...(platform.version ? { appVersion: platform.version } : {}),
        }),
      })

      const data = (await res.json()) as any
      if (!res.ok || !data.ok) {
        setError(data.error || language.t("login.error.invalid"))
        setLoading(false)
        return
      }

      tenantAuth.login(data.user, data.tenant)
      setPassword("")
      setError(null)
    } catch {
      setError(language.t("login.error.connection"))
    } finally {
      setLoading(false)
    }
  }

  const initials = () => {
    const name = tenantAuth.store.user?.name || tenantAuth.store.lastEmail || "User"
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <Show when={!tenantAuth.isLoggedIn()}>
      <div
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md"
        style={{ background: "rgba(3, 10, 8, 0.72)" }}
      >
        <div class="flex w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-v2-border-border-strong bg-v2-background-bg-layer-02 shadow-2xl">
          {/* BANNER: primeiro acesso (institucional) ou tenant reconhecido */}
          <Show
            when={isRecognized()}
            fallback={
              <div
                class="relative overflow-hidden px-7 py-6"
                style={{ background: "linear-gradient(135deg, #0c1a14 0%, #09130e 60%, #040806 100%)" }}
              >
                <div class="relative z-10 flex items-center gap-3.5">
                  <div
                    class="flex size-11 items-center justify-center rounded-xl text-lg font-semibold"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#7ee2b8", border: "1px solid rgba(126,226,184,0.35)" }}
                  >
                    A
                  </div>
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="text-16-medium" style={{ color: "#ffffff" }}>
                        AllCode
                      </span>
                      <span
                        class="rounded px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                        style={{ background: "rgba(126,226,184,0.12)", color: "#7ee2b8", border: "1px solid rgba(126,226,184,0.35)" }}
                      >
                        ENTERPRISE
                      </span>
                    </div>
                    <span class="text-12-regular" style={{ color: "rgba(255,255,255,0.66)" }}>
                      {language.t("login.subtitle")}
                    </span>
                  </div>
                </div>
              </div>
            }
          >
            <div
              class="relative overflow-hidden px-7 py-6"
              style={{
                background: `linear-gradient(135deg, ${tenant()?.brandColor || "#064e3b"} 0%, #042f24 60%, #021a14 100%)`,
              }}
            >
              <div class="relative z-10 flex items-center gap-4">
                <Show
                  when={tenant()?.logoUrl}
                  fallback={
                    <div
                      class="flex size-14 items-center justify-center rounded-xl text-xl font-semibold"
                      style={{ background: "#ffffff", color: "#0b3b2e" }}
                    >
                      {tenant()?.name?.slice(0, 2).toUpperCase() || "OR"}
                    </div>
                  }
                >
                  <div class="flex size-14 items-center justify-center rounded-xl bg-white p-1.5 shadow-md">
                    <img
                      src={
                        tenant()!.logoUrl!.startsWith("http")
                          ? tenant()!.logoUrl!
                          : `${DEFAULT_AUTH_URL}${tenant()!.logoUrl!}`
                      }
                      alt={tenant()?.name}
                      class="max-h-full max-w-full object-contain"
                    />
                  </div>
                </Show>

                <div class="flex min-w-0 flex-col">
                  <span class="truncate text-16-medium" style={{ color: "#ffffff" }}>
                    {tenant()?.name}
                  </span>
                  <span class="text-12-regular" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {language.t("login.workspace")}
                  </span>
                </div>
              </div>

              <Show when={tenant()?.welcomeMessage}>
                <p class="mt-3 text-12-regular leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {tenant()?.welcomeMessage}
                </p>
              </Show>
            </div>
          </Show>

          <div class="flex flex-col gap-4 p-7">
            {/* Usuário reconhecido: avatar + nome + e-mail em contraste alto */}
            <Show when={isRecognized()}>
              <div class="flex items-center justify-between gap-3 rounded-xl border border-v2-border-border-base bg-v2-background-bg-base p-3">
                <div class="flex min-w-0 items-center gap-3">
                  <div
                    class="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: BRAND, color: "#ffffff" }}
                  >
                    {initials()}
                  </div>
                  <div class="flex min-w-0 flex-col">
                    <span class="truncate text-14-medium text-v2-text-text-base">
                      {tenantAuth.store.user?.name || tenantAuth.store.lastEmail}
                    </span>
                    <Show when={tenantAuth.store.user?.name}>
                      <span class="truncate text-12-regular text-v2-text-text-muted">
                        {tenantAuth.store.lastEmail}
                      </span>
                    </Show>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => tenantAuth.switchAccount()}
                  class="shrink-0 rounded-lg border border-v2-border-border-base px-2.5 py-1 text-12-medium text-v2-text-text-muted transition hover:bg-v2-background-bg-layer-01 hover:text-v2-text-text-base cursor-pointer"
                >
                  {language.t("login.switchAccount")}
                </button>
              </div>
            </Show>

            <form onSubmit={handleLogin} class="flex flex-col gap-4">
              <Show when={!isRecognized()}>
                <div class="flex flex-col gap-1.5">
                  <label for="tenant-login-email" class="text-12-medium text-v2-text-text-muted">
                    {language.t("login.email")}
                  </label>
                  <input
                    id="tenant-login-email"
                    type="email"
                    required
                    autocomplete="username"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    placeholder="exemplo@empresa.com"
                    class="h-10 w-full rounded-lg border border-v2-border-border-strong bg-v2-background-bg-base px-3 text-14-regular text-v2-text-text-base placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus focus:outline-none transition"
                  />
                </div>
              </Show>

              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label for="tenant-login-password" class="text-12-medium text-v2-text-text-muted">
                    {language.t("login.password")}
                  </label>
                  <Show when={tenantAuth.canChangePassword()}>
                    <a
                      href={`${DEFAULT_AUTH_URL}/recuperar-senha`}
                      target="_blank"
                      class="text-12-medium text-v2-text-text-accent transition hover:text-v2-text-text-accent-hover"
                    >
                      {language.t("login.forgot")}
                    </a>
                  </Show>
                </div>
                <div class="relative">
                  <input
                    id="tenant-login-password"
                    type={showPassword() ? "text" : "password"}
                    required
                    autocomplete="current-password"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    placeholder="••••••••••••"
                    class="h-10 w-full rounded-lg border border-v2-border-border-strong bg-v2-background-bg-base px-3 pr-20 text-14-regular text-v2-text-text-base placeholder:text-v2-text-text-faint focus:border-v2-border-border-focus focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword())}
                    class="absolute top-2.5 right-3 text-12-medium text-v2-text-text-muted transition hover:text-v2-text-text-base cursor-pointer"
                  >
                    {showPassword() ? language.t("login.hidePassword") : language.t("login.showPassword")}
                  </button>
                </div>
              </div>

              <Show when={error()}>
                <div class="flex items-center gap-2 rounded-lg border border-v2-border-border-base bg-surface-critical-weak p-3 text-12-regular text-text-on-critical-base">
                  <Icon name="close" size="small" class="shrink-0" />
                  <span>{error()}</span>
                </div>
              </Show>

              <Show when={tenantAuth.store.revokedNotice}>
                <div class="flex items-start gap-2.5 rounded-lg border border-v2-border-border-base bg-surface-critical-weak p-3 text-12-regular text-text-on-critical-base">
                  <Icon name="warning" size="small" class="mt-0.5 shrink-0" />
                  <div class="flex flex-col gap-0.5">
                    <span class="text-12-medium">{language.t(revokedCopy().title)}</span>
                    <span>{language.t(revokedCopy().body)}</span>
                  </div>
                </div>
              </Show>

              <button
                type="submit"
                disabled={loading()}
                class="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-14-medium shadow-md transition disabled:opacity-50 cursor-pointer"
                style={{ background: BRAND, color: "#ffffff" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BRAND_HOVER)}
                onMouseLeave={(e) => (e.currentTarget.style.background = BRAND)}
              >
                <Show
                  when={loading()}
                  fallback={
                    isRecognized()
                      ? language.t("login.submitTenant", { tenant: tenant()?.name || "AllCode" })
                      : language.t("login.submit")
                  }
                >
                  <span class="flex size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>{language.t("login.authenticating")}</span>
                </Show>
              </button>
            </form>

            <div class="border-t border-v2-border-border-base pt-3 text-center text-12-regular text-v2-text-text-faint">
              {language.t("login.footer")}
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
