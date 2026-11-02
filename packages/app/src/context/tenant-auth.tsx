import { createSimpleContext } from "@allcode/ui/context"
import { persisted, Persist } from "@/utils/persist"
import { createStore } from "solid-js/store"
import { createMemo, onMount, onCleanup } from "solid-js"
import { usePlatform } from "@/context/platform"

const DEFAULT_AUTH_URL = "https://allcode.alltomatos.dev.br"

export interface TenantPlan {
  id: string
  name: string
  pricingMode: "per_user" | "package"
  priceCents: number
}

export interface TenantInfo {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  welcomeMessage?: string | null
  brandColor?: string
  offlineGraceHours?: number
  maxUsers?: number
  planType?: "trial" | "paid"
  trialEndsAt?: string | null
  isTrial?: boolean
  trialDaysRemaining?: number | null
  plan?: TenantPlan | null
}

export type BlockReason = "trial_expired" | "tenant_suspended" | "account_suspended" | "account_deleted" | "revoked"

export interface UserPermissions {
  agentui: boolean
  routines: boolean
  changePassword: boolean
}

export type AccessResource =
  | "agentui"
  | "routines"
  | "servers"
  | "providers"
  | "models"
  | "combos"
  | "skills"
  | "memories"
  | "mcp"

export type SettingsSection =
  | "providers"
  | "models"
  | "combos"
  | "skills"
  | "memories"
  | "mcp"
  | "servers"
  | "routines"
  | "agents"

export interface ModelDefault {
  provider?: string
  model?: string
}

export interface ProvisionedProvider {
  id: string
  name: string
  kind: "builtin" | "custom" | "proxy"
  protocol?: "openai" | "anthropic"
  npm?: string
  baseURL?: string
  apiKey?: string
  models: Array<{ id: string; name: string; enabled?: boolean }>
  headers: Record<string, string>
  env: string[]
}

export interface ProviderPolicy {
  restricted: boolean
  allowLocal: boolean
  allowed: string[]
  denied: string[]
  version: string
  provisioned?: ProvisionedProvider[]
}

export interface UserSession {
  id: string
  name: string
  email: string
  role: string
  mustChangePassword?: boolean
  permissions?: UserPermissions
  access?: Partial<Record<AccessResource, boolean>>
  settings?: Partial<Record<SettingsSection, boolean>>
  canOpenSettings?: boolean
  defaultModel?: ModelDefault
  providers?: ProviderPolicy
}

export interface SessionModelUsage {
  providerID: string
  modelID: string
  tokens: number
  costUsd: number
  calls: number
}

export interface SessionAuditPayload {
  sessionID: string
  title: string
  summary: string
  workspace: string
  startedAt: number
  endedAt?: number
  tokensTotal: number
  tokensInput: number
  tokensOutput: number
  tokensReasoning: number
  costUsd: number
  durationMs: number
  messagesCount: number
  modelUsage: SessionModelUsage[]
}

export interface TenantAuthState {
  user?: UserSession
  tenant?: TenantInfo
  isLoggedIn: boolean
  lastEmail?: string
  revokedNotice?: boolean
  blockReason?: BlockReason
}

const DEFAULT_STATE: TenantAuthState = {
  isLoggedIn: false,
}

export const { use: useTenantAuth, provider: TenantAuthProvider } = createSimpleContext({
  name: "TenantAuth",
  init: () => {
    const [store, setStore, _, ready] = persisted(
      Persist.global("tenant.auth.v1"),
      createStore<TenantAuthState>(DEFAULT_STATE),
    )

    const platform = usePlatform()
    const appVersion = () => platform.version

    const isLoggedIn = createMemo(() => Boolean(store.isLoggedIn && store.user))
    const isFirstLogin = createMemo(() => !store.tenant && !store.lastEmail)

    // RBAC: Owner e Admin têm acesso total; membros seguem o mapa de acesso
    // resolvido pelo portal (indivíduo > grupos > padrão do tenant).
    const isPrivileged = () => {
      const u = store.user
      return u?.role === "owner" || u?.role === "admin"
    }

    const canUse = (resource: AccessResource) => {
      const u = store.user
      if (!u) return false
      if (isPrivileged()) return true
      const value = u.access?.[resource]
      if (value !== undefined) return value
      if (resource === "agentui") return u.permissions?.agentui ?? true
      if (resource === "routines") return u.permissions?.routines ?? true
      return true
    }

    const canUseAgentUI = createMemo(() => canUse("agentui"))
    const canUseRoutines = createMemo(() => canUse("routines"))

    const canChangePassword = createMemo(() => {
      const u = store.user
      if (!u) return false
      if (u.role === "owner" || u.role === "admin") return true
      return u.permissions?.changePassword ?? true
    })

    const canOpenSettings = createMemo(() => {
      const u = store.user
      if (!u) return false
      if (u.role === "owner" || u.role === "admin") return true
      return u.canOpenSettings !== false
    })

    const canUseSettings = (section: SettingsSection) => {
      const u = store.user
      if (!u) return false
      if (isPrivileged()) return true
      if (u.canOpenSettings === false) return false
      const value = u.settings?.[section]
      return value !== false
    }

    const defaultModel = createMemo(() => {
      const explicit = store.user?.defaultModel
      if (explicit?.provider && explicit?.model) return explicit
      const firstProvisioned = store.user?.providers?.provisioned?.[0]
      if (firstProvisioned) {
        const firstModel = firstProvisioned.models?.[0]?.id ?? "auto"
        return { provider: firstProvisioned.id, model: firstModel }
      }
      return undefined
    })
    const providerPolicy = createMemo(() => store.user?.providers)

    const canConfigureProviders = createMemo(() => {
      const u = store.user
      if (!u) return true
      if (isPrivileged()) return true
      if (canUse("providers") === false) return false
      const policy = store.user?.providers
      if (!policy) return true
      if (policy.restricted && !policy.allowLocal) return false
      return true
    })

    const login = (user: UserSession, tenant: TenantInfo) => {
      setStore({
        user,
        tenant,
        isLoggedIn: true,
        lastEmail: user.email,
        revokedNotice: false,
        blockReason: undefined,
      })
    }

    const logout = (revoked = false, reason?: BlockReason) => {
      setStore({
        user: undefined,
        isLoggedIn: false,
        revokedNotice: revoked,
        blockReason: revoked ? (reason ?? "revoked") : undefined,
      })
    }

    const switchAccount = () => {
      setStore({
        user: undefined,
        tenant: undefined,
        isLoggedIn: false,
        lastEmail: undefined,
        revokedNotice: false,
        blockReason: undefined,
      })
    }

    const clearRevokedNotice = () => {
      setStore({ revokedNotice: false, blockReason: undefined })
    }

    const blockReasonFrom = (data: unknown): BlockReason => {
      const reason = typeof data === "object" && data !== null ? (data as { reason?: unknown }).reason : undefined
      if (reason === "trial_expired") return "trial_expired"
      if (reason === "tenant_suspended") return "tenant_suspended"
      if (reason === "deleted") return "account_deleted"
      if (reason === "suspended") return "account_suspended"
      return "revoked"
    }

    // Checagem de status no backend (revogação imediata / bloqueio)
    const checkStatus = async () => {
      const u = store.user
      const t = store.tenant
      if (!u || !t || !store.isLoggedIn) return

      try {
        const version = appVersion()
        const query = new URLSearchParams({ userId: u.id, orgId: t.id })
        if (version) query.set("appVersion", version)
        const res = await fetch(`${DEFAULT_AUTH_URL}/api/v1/auth/status?${query.toString()}`)
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean
          status?: string
          reason?: string
          tenant?: TenantInfo
          permissions?: UserPermissions
          access?: Partial<Record<AccessResource, boolean>>
          settings?: Partial<Record<SettingsSection, boolean>>
          canOpenSettings?: boolean
          defaultModel?: ModelDefault
          providers?: ProviderPolicy
        } | null

        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            // Distingue trial expirado, empresa suspensa e revogação de conta
            // para que o usuário veja o motivo real do bloqueio.
            logout(true, blockReasonFrom(body))
          }
          return
        }

        if (!body) return
        if (body.status === "suspended" || body.status === "deleted") {
          // Acesso revogado imediatamente pelo administrador
          logout(true, body.status === "deleted" ? "account_deleted" : "account_suspended")
          return
        }

        // Mantém branding, plano e janela de trial atualizados no app
        if (body.tenant) setStore("tenant", body.tenant)

        if (body.permissions) {
          // Sincroniza permissões RBAC caso o administrador tenha alterado no portal
          setStore("user", "permissions", body.permissions)
          if (body.access) setStore("user", "access", body.access)
          if (body.settings) setStore("user", "settings", body.settings)
          if (typeof body.canOpenSettings === "boolean") setStore("user", "canOpenSettings", body.canOpenSettings)
          if (body.defaultModel) setStore("user", "defaultModel", body.defaultModel)
          if (body.providers) setStore("user", "providers", body.providers)
        }
      } catch {
        // Modo offline / falha transitória de rede: respeita o token em cache
      }
    }

    // Envio de resumo e métricas executivas da sessão para auditoria do tenant
    const recordSessionAudit = async (payload: SessionAuditPayload) => {
      const u = store.user
      const t = store.tenant
      if (!u || !t) return

      try {
        await fetch(`${DEFAULT_AUTH_URL}/api/v1/sessions/audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            startedAt: new Date(payload.startedAt).toISOString(),
            endedAt: payload.endedAt ? new Date(payload.endedAt).toISOString() : undefined,
            userId: u.id,
            orgId: t.id,
            appVersion: appVersion(),
          }),
        })
      } catch {
        // Envio assíncrono best-effort, sem quebrar UX local
      }
    }

    // Polling periódico para revogação imediata (a cada 60s)
    onMount(() => {
      const interval = setInterval(checkStatus, 60_000)
      window.addEventListener("focus", checkStatus)

      onCleanup(() => {
        clearInterval(interval)
        window.removeEventListener("focus", checkStatus)
      })
    })

    return {
      store,
      isLoggedIn,
      isFirstLogin,
      canUseAgentUI,
      canUseRoutines,
      canChangePassword,
      canUse,
      canOpenSettings,
      canUseSettings,
      defaultModel,
      providerPolicy,
      canConfigureProviders,
      canOverrideCorporate: canConfigureProviders,
      login,
      logout,
      switchAccount,
      clearRevokedNotice,
      checkStatus,
      recordSessionAudit,
    }
  },
})
