export const DEFAULT_PANEL_URL = "https://allcode.alltomatos.dev.br"

type TenantRequestContext = {
  panelUrl: string
  userID: string
  orgID: string
}

let current: TenantRequestContext | undefined

export function setTenantRequestContext(input: TenantRequestContext | undefined) {
  current = input
}

export function tenantRequestHeaders(): Record<string, string> | undefined {
  if (!current) return undefined
  return {
    "x-allcode-panel-url": current.panelUrl,
    "x-allcode-user-id": current.userID,
    "x-allcode-org-id": current.orgID,
  }
}

export function withTenantHeaders(baseFetch: typeof globalThis.fetch): typeof globalThis.fetch {
  return ((input, init) => {
    const headers = tenantRequestHeaders()
    if (!headers) return baseFetch(input, init)
    const merged = new Headers(init?.headers)
    for (const [key, value] of Object.entries(headers)) merged.set(key, value)
    return baseFetch(input, { ...init, headers: merged })
  }) as typeof globalThis.fetch
}
