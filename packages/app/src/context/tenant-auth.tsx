import { createSimpleContext } from "@allcode/ui/context"
import { persisted, Persist } from "@/utils/persist"
import { createStore } from "solid-js/store"
import { createMemo, onMount, onCleanup } from "solid-js"

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

export interface UserSession {
  id: string
  name: string
  email: string
  role: string
  mustChangePassword?: boolean
  permissions?: UserPermissions
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

    const isLoggedIn = createMemo(() => Boolean(store.isLoggedIn && store.user))
    const isFirstLogin = createMemo(() => !store.tenant && !store.lastEmail)

    // RBAC: Owner e Admin têm acesso total; membros seguem as permissões granulares configuradas
    const canUseAgentUI = createMemo(() => {
      const u = store.user
      if (!u) return false
      if (u.role === "owner" || u.role === "admin") return true
      return u.permissions?.agentui ?? true
    })

    const canUseRoutines = createMemo(() => {
      const u = store.user
      if (!u) return false
      if (u.role === "owner" || u.role === "admin") return true
      return u.permissions?.routines ?? true
    })

    const canChangePassword = createMemo(() => {
      const u = store.user
      if (!u) return false
      if (u.role === "owner" || u.role === "admin") return true
      return u.permissions?.changePassword ?? true
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
        const url = `${DEFAULT_AUTH_URL}/api/v1/auth/status?userId=${encodeURIComponent(u.id)}&orgId=${encodeURIComponent(t.id)}`
        const res = await fetch(url)
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
      login,
      logout,
      switchAccount,
      clearRevokedNotice,
      checkStatus,
      recordSessionAudit,
    }
  },
})
