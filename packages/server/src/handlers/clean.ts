/**
 * O catálogo carrega `fetch` dentro de `api.settings` para providers que falam
 * protocolo proprietário (AGY, Kiro). Função não serializa em JSON: sem remover
 * esse campo, `/api/provider` e `/api/model` respondem 500 com
 * `InvalidRequestError`. Vale para provider e para modelo.
 */
type HasApiSettings = { api?: { settings?: unknown } }

function clean<T extends HasApiSettings>(value: T): T {
  const settings = value?.api?.settings
  if (!settings || typeof settings !== "object") return value
  const { fetch: _fetch, ...safeSettings } = settings as Record<string, unknown>
  return {
    ...value,
    api: {
      ...value.api,
      settings: safeSettings,
    },
  } as T
}

export function cleanProvider<T extends HasApiSettings>(provider: T) {
  return clean(provider)
}

export function cleanModel<T extends HasApiSettings>(model: T) {
  return clean(model)
}

