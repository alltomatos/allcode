import { Show, createSignal, onMount } from "solid-js"
import { useTenantAuth } from "@/context/tenant-auth"
import { useLanguage } from "@/context/language"
import { ButtonV2 } from "@allcode/ui/v2/button-v2"
import { Icon } from "@allcode/ui/icon"
import { Icon as IconV2 } from "@allcode/ui/v2/icon"

const DEFAULT_AUTH_URL = "https://allcode.alltomatos.dev.br"

export function DesktopLoginModal() {
  const tenantAuth = useTenantAuth()
  const language = useLanguage()

  const [email, setEmail] = createSignal(tenantAuth.store.lastEmail || "")
  const [password, setPassword] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [showPassword, setShowPassword] = createSignal(false)

  const tenant = () => tenantAuth.store.tenant
  const isRecognized = () => Boolean(tenant() && tenantAuth.store.lastEmail)

  async function handleLogin(e: SubmitEvent) {
    e.preventDefault()
    const mail = (isRecognized() ? tenantAuth.store.lastEmail : email())?.trim().toLowerCase() || ""
    const pass = password()

    if (!mail || !pass) {
      setError("Preencha o e-mail e a palavra-passe.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${DEFAULT_AUTH_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: mail, password: pass }),
      })

      const data = (await res.json()) as any
      if (!res.ok || !data.ok) {
        setError(data.error || "Credenciais inválidas ou acesso recusado.")
        setLoading(false)
        return
      }

      tenantAuth.login(data.user, data.tenant)
      setPassword("")
      setError(null)
    } catch (err: any) {
      setError(err?.message || "Erro ao conectar com o portal AllCode.")
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
      <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div class="flex flex-col w-full max-w-[560px] overflow-hidden rounded-2xl border border-v2-border-border-strong bg-v2-background-bg-layer-02 shadow-2xl">
          
          {/* ============================================================== */}
          {/* BANNER SUPERIOR: 1º LOGIN (ALLCODE NATIVO) vs TENANT RECONHECIDO */}
          {/* ============================================================== */}
          <Show
            when={isRecognized()}
            fallback={
              /* BANNER DO 1º LOGIN (AllCode Institucional) */
              <div class="relative overflow-hidden bg-gradient-to-br from-[#0c1a14] via-[#09130e] to-[#040806] px-8 py-7 border-b border-v2-border-border-base">
                <div class="absolute -right-8 -top-8 size-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
                <div class="relative z-10 flex flex-col gap-3">
                  <div class="flex items-center gap-3.5">
                    <div class="flex size-11 items-center justify-center rounded-xl bg-v2-background-bg-base border border-emerald-500/30 text-emerald-400 font-bold text-xl shadow-sm">
                      A
                    </div>
                    <div class="flex flex-col">
                      <div class="flex items-center gap-2">
                        <span class="text-18-bold text-white tracking-tight">AllCode</span>
                        <span class="rounded bg-emerald-950/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                          ENTERPRISE
                        </span>
                      </div>
                      <span class="text-12-regular text-slate-400">
                        Plataforma de Desenvolvimento e Automação com IA
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 px-3.5 py-2 text-11-medium text-emerald-200">
                    <span class="flex size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Inicie sessão com o seu e-mail corporativo para carregar o seu ambiente de trabalho.</span>
                  </div>
                </div>
              </div>
            }
          >
            {/* BANNER APÓS 1º LOGIN: LOGO DA EMPRESA + BOAS-VINDAS CUSTOMIZADAS */}
            <div
              class="relative overflow-hidden px-8 py-7 border-b border-emerald-800/40 transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${tenant()?.brandColor || "#064e3b"} 0%, #042f24 60%, #021a14 100%)`,
              }}
            >
              <div class="absolute -right-10 -bottom-10 size-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
              <div class="relative z-10 flex flex-col gap-3.5">
                <div class="flex items-center gap-4">
                  <Show
                    when={tenant()?.logoUrl}
                    fallback={
                      <div class="flex size-14 items-center justify-center rounded-xl bg-white text-emerald-800 font-bold text-2xl shadow-md border border-white/40">
                        {tenant()?.name?.slice(0, 2).toUpperCase() || "OR"}
                      </div>
                    }
                  >
                    <div class="flex size-14 items-center justify-center rounded-xl bg-white p-1.5 shadow-md border border-white/40">
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

                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="text-19-bold text-white tracking-tight">{tenant()?.name}</span>
                      <span class="rounded bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-400/30">
                        HOMOLOGADO
                      </span>
                    </div>
                    <span class="text-12-regular text-emerald-100/80">
                      Workspace Corporativo Seguro
                    </span>
                  </div>
                </div>

                {/* Mensagem Personalizada de Boas-Vindas */}
                <Show when={tenant()?.welcomeMessage}>
                  <div class="flex flex-col rounded-lg bg-black/45 border border-emerald-500/30 px-3.5 py-2.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      Comunicado da Organização:
                    </span>
                    <p class="text-12-medium text-white/95 mt-0.5 leading-relaxed">
                      "{tenant()?.welcomeMessage}"
                    </p>
                  </div>
                </Show>
              </div>
            </div>
          </Show>

          {/* ============================================================== */}
          {/* CORPO DO FORMULÁRIO DE LOGIN                                    */}
          {/* ============================================================== */}
          <div class="p-8 flex flex-col gap-5">
            <Show when={isRecognized()}>
              <div class="flex items-center justify-between rounded-xl border border-emerald-800/40 bg-[#071912] p-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="flex size-10 items-center justify-center rounded-full bg-emerald-800 text-white font-bold text-xs shadow-xs">
                    {initials()}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-13-semibold text-white truncate">
                      {tenantAuth.store.user?.name || "Colaborador"}
                    </span>
                    <span class="text-11-regular text-emerald-400 truncate">
                      {tenantAuth.store.lastEmail}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => tenantAuth.switchAccount()}
                  class="rounded-lg border border-v2-border-border-base bg-v2-background-bg-base px-2.5 py-1 text-11-medium text-v2-text-text-muted hover:text-white transition cursor-pointer"
                >
                  Trocar conta
                </button>
              </div>
            </Show>

            <form onSubmit={handleLogin} class="flex flex-col gap-4">
              <Show when={!isRecognized()}>
                <div class="flex flex-col gap-1.5">
                  <label class="text-12-medium text-v2-text-text-muted">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    required
                    autocomplete="username"
                    value={email()}
                    onInput={(e) => setEmail(e.currentTarget.value)}
                    placeholder="exemplo@empresa.com"
                    class="h-10 w-full rounded-lg border border-v2-border-border-strong bg-v2-background-bg-base px-3 text-13-regular text-v2-text-text-base placeholder:text-v2-text-text-disabled focus:border-emerald-500 focus:outline-none transition"
                  />
                </div>
              </Show>

              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-12-medium text-v2-text-text-muted">
                    Palavra-passe
                  </label>
                  <Show when={tenantAuth.canChangePassword()}>
                    <a
                      href={`${DEFAULT_AUTH_URL}/recuperar-senha`}
                      target="_blank"
                      class="text-11-medium text-emerald-400 hover:text-emerald-300 transition"
                    >
                      Recuperar acesso
                    </a>
                  </Show>
                </div>
                <div class="relative">
                  <input
                    type={showPassword() ? "text" : "password"}
                    required
                    autocomplete="current-password"
                    value={password()}
                    onInput={(e) => setPassword(e.currentTarget.value)}
                    placeholder="••••••••••••"
                    class="h-10 w-full rounded-lg border border-v2-border-border-strong bg-v2-background-bg-base px-3 pr-14 text-13-regular text-v2-text-text-base placeholder:text-v2-text-text-disabled focus:border-emerald-500 focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword())}
                    class="absolute right-3 top-2.5 text-xs text-v2-text-text-muted hover:text-white transition cursor-pointer"
                  >
                    {showPassword() ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              <Show when={error()}>
                <div class="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-12-regular text-rose-300">
                  <Icon name="close" size="small" class="text-rose-400 shrink-0" />
                  <span>{error()}</span>
                </div>
              </Show>

              <Show when={tenantAuth.store.revokedNotice}>
                <div class="flex items-start gap-2.5 rounded-lg border border-rose-500/50 bg-rose-950/60 p-3 text-12-regular text-rose-200">
                  <Icon name="warning" size="small" class="text-rose-400 shrink-0 mt-0.5" />
                  <div class="flex flex-col">
                    <span class="font-semibold text-rose-100">Acesso revogado ou suspenso</span>
                    <span>O seu acesso ao AllCode Desktop foi desativado pelo administrador da sua organização. Entre em contacto com o suporte interno.</span>
                  </div>
                </div>
              </Show>

              <button
                type="submit"
                disabled={loading()}
                class="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-14-medium text-white shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <Show when={loading()} fallback={isRecognized() ? `Aceder ao ${tenant()?.name || "AllCode"}` : "Entrar no AllCode Desktop"}>
                  <span class="flex size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Autenticando...</span>
                </Show>
              </button>
            </form>

            <div class="pt-2 text-center text-11-regular text-v2-text-text-muted border-t border-v2-border-border-base">
              Plataforma protegida e operada por <span class="font-semibold text-slate-300">AllCode by Alltomatos</span>
            </div>
          </div>

        </div>
      </div>
    </Show>
  )
}
