---
name: allcode-project-expert
description: Especialista no repositório alltomatos/allcode — arquitetura e pacotes (CLI/TUI, core Effect, app SolidJS, Electron desktop, painel SaaS em Cloudflare), fluxo de build, branches dev/prod, workflows de publicação (npm @alltomatos/allcode e binários por plataforma, release-desktop, publish-release, release-desktop-dev), versionamento, changelog, deploy do painel (D1/R2/Wrangler) e convenções internas. Use sempre que a tarefa envolver este repositório: entender onde algo fica, mexer em release/versionamento/changelog, publicar ou promover versões, alterar workflows, diagnosticar falhas de build/deploy, ou quando alguém perguntar "como esse projeto é organizado", "como faço o release", "o que é dev/prod", "por que o updater quebrou", mesmo sem citar os nomes exatos.
---

# AllCode Project Expert

Mapa vivo do repositório `alltomatos/allcode`. Use isto para **não redescobrir** arquitetura, release e operações a cada sessão.

## Como usar

1. Para entender o que é cada pacote, o fluxo de dados e onde mexer: leia `references/architecture.md`.
2. Para bump, changelog, tag, promoção `dev` → `prod`, npm e builds do desktop: leia `references/release.md`.
3. Para deploy do painel (Cloudflare/D1/R2), segredos, privacidade do repo e feed de atualizações: leia `references/operations.md`.

Se você descobrir algo novo e durável (mudança de processo, workflow novo, armadilha recorrente), **atualize estes arquivos antes de encerrar a tarefa**. O arquivo é a memória do projeto, não a conversa.

## Regras de ouro

- Branch padrão é **`dev`** — a única branch ativa. Releases estáveis saem de **tags anotadas `vX.Y.Z`** criadas em `dev`; `prod` está congelada e não dispara mais release.
- Commits no padrão `type(scope): summary` — `feat`, `fix`, `docs`, `chore`, `refactor`, `test`. Branches com no máximo 3 palavras separadas por hífen, sem prefixo `feat/`.
- **Nunca rode testes a partir da raiz** (guard `do-not-run-tests-from-root`). Rode de `packages/<pkg>`.
- Typecheck é sempre `bun run typecheck` no diretório do pacote (nunca `tsc` direto).
- **Changelog de release não inclui mudanças do portal/painel.** Só desktop/TUI/core/SDK/plugins. Detalhes em `references/release.md`.
- O repositório é privado; o feed de atualizações e os instaladores precisam de um repositório público separado (`allcode-release`). Ver `references/operations.md`.
- Não faça commit/push/deploy/release sem confirmação explícita.

## Atalhos

| Preciso... | Onde |
|---|---|
| Rodar o painel | `bun run dev:panel` (porta 3003) |
| Rodar o desktop em dev | `bun run dev:local` |
| Rodar app web + backend | backend `packages/allcode`: `bun run --conditions=browser ./src/index.ts serve --port 4096`; app `packages/app`: `bun dev -- --port 4444` |
| Publicar painel | `cd packages/panel && bun run deploy` |
| Gerar release | bump → changelog → commits → tag → push `dev` → validar → ff `prod` → push |
| Ver workflows | `.github/workflows/` |
| Regra do changelog | `.opencode/command/changelog.md` |

## Armadilhas já pagas

- **Ordem de providers no SolidJS**: componentes que usam `useServerSync()`/`useServer()` só podem montar dentro de `ServerSyncProvider`/`ServerProvider`. Montar no router root quebra o app com "context must be used within a context provider" (aconteceu na v1.27.1–1.27.3 com `TenantProviderPolicySync`).
- **npm com token granular**: token que "bypassa 2FA" não pode `unpublish`/operações sensíveis. Precisa de token sem bypass + OTP, ou UI do npm.
- **npm processing**: após `npm publish`, a versão pode levar ~1–2 min para aparecer no registry ("Your package is being processed"). Não conclua que falhou antes de esperar.
- **Descompasso de versões**: publicar no npm usa `packages/desktop/package.json` como base do número; se `allcode`/`app`/`desktop` não estiverem sincronizados, o artefato sai com número errado.
- **`prod` sem versão publicada**: uma release pode existir no changelog git e nunca ter sido promovida (ex.: v1.27.2). Sempre confira `npm view`/`gh release list`, não só o changelog.
