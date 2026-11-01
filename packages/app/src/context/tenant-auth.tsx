import { createSimpleContext } from "@allcode/ui/context"
import { persisted, Persist } from "@/utils/persist"
import { createStore } from "solid-js/store"
import { createMemo, onMount, onCleanup } from "solid-js"
import { usePlatform } from "@/context/platform"

const DEFAULT_AUTH_URL = "https://allcode.alltomatos.dev.br"

export interface TenantInfo {
  id: string
  name: string
  slug: string
  logoUrl?: string | null
  welcomeMessage?: string | null
  brandColor?: string
  offlineGraceHours?: number
}

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
      })
    }

    const logout = (revoked = false) => {
      setStore({
        user: undefined,
        isLoggedIn: false,
        revokedNotice: revoked,
      })
    }

    const switchAccount = () => {
      setStore({
        user: undefined,
        tenant: undefined,
        isLoggedIn: false,
        lastEmail: undefined,
        revokedNotice: false,
      })
    }

    const clearRevokedNotice = () => {
      setStore("revokedNotice", false)
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
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            logout(true)
          }
          return
        }
        const data = (await res.json()) as any
        if (data.ok && data.status) {
          if (data.status === "suspended" || data.status === "deleted") {
            // Acesso revogado imediatamente pelo administrador
            logout(true)
          } else if (data.permissions) {
            // Sincroniza permissões RBAC caso o administrador tenha alterado no portal
            setStore("user", "permissions", data.permissions)
            if (data.access) setStore("user", "access", data.access)
            if (data.settings) setStore("user", "settings", data.settings)
            if (typeof data.canOpenSettings === "boolean") setStore("user", "canOpenSettings", data.canOpenSettings)
            if (data.defaultModel) setStore("user", "defaultModel", data.defaultModel)
            if (data.providers) setStore("user", "providers", data.providers)
          }
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
