/**
 * O catalogo carrega `fetch` dentro de `api.settings` para providers que falam
 * protocolo proprietario (AGY, Kiro). Funcao nao serializa em JSON: sem remover
 * esse campo, `/api/provider` e `/api/model` respondem 500 com
 * `InvalidRequestError`. Vale para provider e para modelo.
 *
 * `api.settings`/`request.body` tambem podem carregar credenciais de providers
 * configurados via `provider.options` (apiKey). O runner le o catalogo original;
 * a resposta HTTP nunca deve devolver esses valores.
 */
type Serializable = {
  api?: { settings?: unknown }
  request?: { body?: unknown }
}

const SECRET_KEYS = new Set(["fetch", "apiKey", "accessToken", "refreshToken"])

function omitSecrets(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input
  return Object.fromEntries(Object.entries(input).filter(([key]) => !SECRET_KEYS.has(key)))
}

function clean<T extends Serializable>(value: T): T {
  const settings = value?.api?.settings
  const body = value?.request?.body
  if ((!settings || typeof settings !== "object") && (!body || typeof body !== "object")) return value
  return {
    ...value,
    ...(value.api && settings && typeof settings === "object"
      ? { api: { ...value.api, settings: omitSecrets(settings) } }
      : {}),
    ...(value.request && body && typeof body === "object"
      ? { request: { ...value.request, body: omitSecrets(body) } }
      : {}),
  } as T
}

export function cleanProvider<T extends Serializable>(provider: T) {
  return clean(provider)
}

export function cleanModel<T extends Serializable>(model: T) {
  return clean(model)
}
