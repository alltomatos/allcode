type Bindings = {
  DB?: D1Database
  ASSETS_BUCKET?: R2Bucket
  PANEL_SESSION_SECRET?: string
  PANEL_ADMIN_EMAIL?: string
  PANEL_ADMIN_PASSWORD?: string
  PANEL_PASSWORD_PEPPER?: string
}

export function bindings(): Bindings {
  return (globalThis as { __env__?: Bindings }).__env__ ?? {}
}

export function env(name: keyof Omit<Bindings, "DB" | "ASSETS_BUCKET">, fallback: string): string {
  const val = bindings()[name] ?? process.env[name] ?? fallback
  return typeof val === "string" ? val : fallback
}
