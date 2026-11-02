# Arquitetura e pacotes

## O que é o AllCode

Fork de `anomalyco/opencode` (upstream) mantido por `alltomatos`. Entrega:

- **CLI/TUI/server** em Bun/TypeScript (`packages/allcode`, `packages/tui`, `packages/core`, `packages/llm`).
- **Desktop Electron** (`packages/desktop` + renderer `packages/app`), com auto-update via `electron-updater`.
- **Painel SaaS** (`packages/panel`) em SolidStart/Cloudflare Workers: empresas (tenants), usuários, permissões, provedores, planos, revendas e trial.

## Direção de dependências (não viole)

`Schema` → `Core`/`Protocol` → `Server`.

- `Client` pode depender de `Schema` e `Protocol`, **nunca** de `Core` ou `Server`.
- `sdk-next` compõe `Client + Core + Server`.
- Regra prática: contrato em `schema`/`protocol`, implementação em `core`, borda em `server`/`client`.

## Pacotes principais

| Pacote | Papel | Versão |
|---|---|---|
| `packages/allcode` | CLI/server/TUI entrypoint, sessões, providers, tools | `1.27.x` (publicado npm) |
| `packages/core` | Núcleo Effect (sessão, tool runtime, provider registry) | `1.18.x` |
| `packages/llm` | Protocolos de provedores (OpenAI, Anthropic, Gemini, Bedrock) | `1.18.x` |
| `packages/tui` | Interface de terminal | `1.18.x` |
| `packages/app` | Renderer SolidJS (layouts novo/legado) | `1.27.x` |
| `packages/desktop` | Electron main/preload, electron-builder, updater | `1.27.x` |
| `packages/ui` / `session-ui` | Design system e componentes de sessão | `1.18.x` |
| `packages/panel` | Portal SaaS (Cloudflare Worker + D1 + R2) | `0.4.x` (independente) |
| `packages/protocol` / `schema` / `client` / `sdk-next` / `server` | Contratos HTTP, tipos, SDK, runtime | — |
| `packages/plugin`, `function`, `containers`, `identity`, `enterprise` | Extensões e infra | `1.18.x` |
| `packages/slack`, `mcpmail`, `mcpm365` | Integrações | — |
| `packages/stats`, `docs`, `web`, `storybook` | Sites e docs | — |

Workspaces usam `bun` + catálogo de versões no `package.json` raiz (campos `catalog:`), lockfile `bun.lock`. Não edite versões de catálogo sem rodar `bun install`.

## Fluxo do desktop

1. Electron (`packages/desktop`) sobe o sidecar do servidor (Bun) e abre a janela com o renderer SolidJS (`packages/app`).
2. No renderer, `AppInterface` (em `packages/app/src/app.tsx`) monta a árvore de providers. Ordem importa:
   `ServerProvider` → `GlobalProvider` → `TenantAuthProvider` → `SettingsProvider` → `ConnectionGate` → router root.
   O `ServerSyncProvider` só existe **abaixo** dos layouts (`SelectedServerProviders` / `ResolvedDraftRoute`). Qualquer componente que use `useServerSync` deve ser montado lá dentro — hoje o `TenantProviderPolicySync` é montado em `ServerScopedProviders`.
3. Login corporativo: `packages/app/src/components/desktop-login-modal.tsx` chama `POST /api/v1/auth/login` no portal; `tenant-auth.tsx` guarda usuário/tenant e faz polling de `GET /api/v1/auth/status` a cada 60s (e no `focus`) para revogação/bloqueio.
4. Auto-update: `electron-updater` com provider `github`, repo `alltomatos/allcode`, canais `latest` (prod) e `dev`.

## Fluxo do painel

- Rotas SolidStart em `packages/panel/src/routes`.
- `/login`, `/app` (empresa), `/4dm1n` (super-admin), `/revenda` (parceiro), `/aviso-trial`.
- Store em `packages/panel/src/lib/store.ts`: implementação D1 (produção) + memória (dev/testes). Migrations em `packages/panel/migrations` (0001…0012).
- Modelo: `Organization` (chamada de "empresa" na UI), `Plan`, `Reseller`, `PanelUser`, grupos de acesso, provedores, credenciais, auditoria de sessão.
- Trial: `planType` (`trial`/`paid`) + `trialEndsAt`; `isTrialExpired`, `getTrialDaysRemaining`, `getEffectiveOrgStatus`. APIs e middleware bloqueiam trial expirado.
- Planos: `per_user` (preço por assento) e `package` (pacote fechado + assento extra). `computePlanMonthlyCents`.
- Assentos: `maxUsers` na empresa; `createUser` bloqueia acima do limite; limites min/max do plano são validados ao atribuir plano/alterar assentos.
- Branding: `logoUrl`, `welcomeMessage`, `brandColor`; upload em `/api/upload-logo` (R2 com fallback base64).
- Contratos consumidos pelo desktop: `/api/v1/auth/login`, `/api/v1/auth/status`, `/api/v1/auth/change-password`, `/api/v1/sessions/audit`.

## Comandos de desenvolvimento

| Objetivo | Comando |
|---|---|
| Painel | `bun run dev:panel` → `http://localhost:3003` |
| Desktop dev (auto-reload do sidecar) | `bun run dev:local` |
| App web + backend | backend em `packages/allcode` na porta 4096; `bun dev -- --port 4444` em `packages/app` |
| Typecheck | `bun run typecheck` no pacote |
| Testes | `bun test` no pacote (nunca na raiz) |
| Lint | `bunx oxlint` na raiz ou arquivos |

## Regras de código do repo

- Sem comentários óbvios; só para restrições surpreendentes.
- Preferir `const`, early return, sem `else`, sem `try/catch` desnecessário, sem `any`.
- Arquivos ~250 linhas como sinal de responsabilidade misturada (não é gate rígido).
- i18n: nunca hardcode texto visível no app; use `language.t`/`plural` e mantenha paridade entre locales (`packages/app/src/i18n/parity.test.ts`).
- Drizzle/schema: colunas em `snake_case`.
- Em Effect generators, ligue serviços a variáveis nomeadas antes de chamar métodos.
