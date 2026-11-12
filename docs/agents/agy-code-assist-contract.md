# Contrato de inferência do Code Assist (AGY) — para o caminho v2

Extraído do adapter v1 (`packages/allcode/src/provider/antigravity-adapter.ts`)
para servir de especificação da rota que falta no core (#40). **Não** é
documentação do que existe no v2 — é o alvo.

## Transporte

```
POST {baseURL}/v1internal:streamGenerateContent?alt=sse   (streaming)
POST {baseURL}/v1internal:generateContent                 (não-streaming)
```

`baseURL` = `https://daily-cloudcode-pa.googleapis.com` no perfil IDE e o
endpoint equivalente no perfil CLI.

Headers: `Authorization: Bearer <access_token>` + headers de cliente Google
usados pelo adapter (`x-goog-api-client` e afins).

## Corpo

O SDK Gemini produz o corpo generateContent; o Code Assist exige um envelope:

```json
{
  "model": "<model id>",
  "project": "<projectID>",
  "request": { /* corpo Gemini: contents, tools, generationConfig, ... */ }
}
```

`projectID` vem de `credential.metadata.projectID`, com fallback
`"aicode-consumers"`.

## Resposta

SSE Gemini, porém **envelopado por frame**: cada `data:` traz
`{ "response": { ...evento Gemini... } }`. O parser precisa desembrulhar
`response` antes de decodificar o evento.

## O que já existe no core e pode ser reaproveitado

- `packages/llm/src/protocols/gemini.ts` — `Gemini.protocol` (corpo + stream)
  e `Gemini.route` (endpoint `/models/{id}:streamGenerateContent?alt=sse`).
- `packages/core/src/session/runner/model.ts` — dispatch de rotas por
  `api.package`.

## Lacunas que impedem reutilizar `Gemini.route` direto

1. **Envelope de request** — `Gemini.protocol.body.from` devolve o corpo puro;
   o Code Assist exige `{ model, project, request }`.
2. **Envelope de resposta** — cada frame vem em `{ response: ... }`.
3. **`projectID` para credencial OAuth** — `SessionRunnerModel.resolve` só
   mescla `credential.metadata` no body quando `credential.type === "key"`.
   AGY é OAuth, então o projeto não chega ao corpo hoje.
4. **Descoberta/refresh** — o adapter v1 tem `loadCodeAssist`,
   `fetchAvailableModels`, `retrieveUserQuota`, rotação de conta e refresh de
   token; nada disso existe no core.

## Rota mínima proposta

```
protocol: CodeAssist (delega Gemini.protocol, envolve request e desembrulha response)
route:    Route.make({
            id: "google-antigravity",
            protocol: CodeAssist.protocol,
            endpoint: Endpoint.path(() => ":streamGenerateContent?alt=sse", { baseURL }),
            auth: Auth.none,        // token vem do credential
            framing: Framing.sse,
          })
```

Depois, em `SessionRunnerModel.resolve`, adicionar o branch para
`package === "@ai-sdk/google"` apontando para essa rota, e permitir que
`credential.metadata` (incluindo `projectID`) chegue ao body também para OAuth.

## Critério de validação

Sem mock: uma sessão real com conta OAuth do AGY, prompt mínimo, verificando
streaming e uso de tools. As contas de dev já existem no perfil local, então a
validação é possível — mas **depois** da rota existir.
