# Operações, painel e segurança

## Painel (Cloudflare)

- Diretório: `packages/panel`; domínio `https://allcode.alltomatos.dev.br`; worker `allcode-panel`.
- Bindings (`wrangler.jsonc`): D1 `allcode-panel` (`DB`), R2 `allcode-panel-assets` (`ASSETS_BUCKET`), assets estáticos `ASSETS`.
- Deploy: `cd packages/panel && bun run deploy` → `vite build` + `finalize` + `wrangler d1 migrations apply --remote` + `wrangler deploy`.
- Migrations: `packages/panel/migrations/NNNN_*.sql` (D1 aplica só as pendentes; 0001…0012 hoje).
- Segredos de produção: `bunx wrangler secret put PANEL_SESSION_SECRET` e `PANEL_ADMIN_PASSWORD` (nunca commitar). `PANEL_ADMIN_EMAIL`/`PANEL_SESSION_SECRET` também existem em dev.
- Upload de logo: `/api/upload-logo` (5MB; png/jpg/jpeg/svg/webp) → R2 ou fallback base64.
- Banco local de testes: `packages/panel/test/store.d1.test.ts` aplica todas as migrations em `bun:sqlite`.
- Versão exibida no rodapé vem de `PANEL_VERSION` (`packages/panel/src/lib/version.ts`).
- **Windows**: o build do painel depende do script `packages/panel/script/fix-solid-start-windows.ts` (rodado por `predev`/`prebuild`/`prebuild:cloudflare`). Ele normaliza caminhos do `@solidjs/start` instalado porque o patch do pacote não é aplicado de forma confiável a dependências resolvidas por URL.

## Instalação e upgrade do CLI

- O script de instalação e a checagem de última versão apontam para o feed público:
  - `https://raw.githubusercontent.com/alltomatos/allcode-release/main/install` (e `install.ps1`)
  - `https://api.github.com/repos/alltomatos/allcode-release/releases/latest`
- `install`/`install.ps1` no repo são espelhados manualmente em `allcode-release/main` a cada mudança; se alterar um deles, replique via API de contents.
- `packages/allcode/src/installation/index.ts` é o consumidor dessas URLs no CLI.

## Segredos e onde vivem

- CI: GitHub Actions secrets (`NPM_TOKEN`, `DISCORD_WEBHOOK`, e os herdados do upstream).
- Painel: Wrangler secrets.
- Nunca commitar `.env`, `.dev.vars`, `.npmrc` com token, chaves `.pem/.p12`. O `.gitignore` raiz cobre `.env`; cada pacote pode ter o seu (o painel ignora `.dev.vars`).
- `packages/panel/.dev.vars.example` e `packages/slack/.env.example` são placeholders e podem ficar versionados.

## Repositório privado + feed de atualizações

O `electron-updater` usa `publish: { provider: "github", owner: "alltomatos", repo: "allcode" }` para os canais `latest` (prod) e `dev`. **Repositório privado quebra o auto-update e o download de instaladores por usuários sem acesso.**

Arquitetura implementada (ago/2026):

1. `alltomatos/allcode` permanece como repositório de código (a ser fechado após validação).
2. `alltomatos/allcode-release` é **público** e hospeda releases/assets, `latest*.yml` e `changelog.json` (branch `main`).
3. `packages/desktop/electron-builder.config.ts` publica em `repo: "allcode-release"` para `prod` e `dev`.
4. `release-desktop`/`release-desktop-dev` usam `secrets.RELEASE_TOKEN` (PAT com `contents: write` em `allcode-release`); `publish-release` desfaz o draft no repo público e sincroniza o `changelog.json`.
5. `release-npm-fork` continua no npm (público).
6. `packages/app/src/context/highlights.tsx` lê `https://raw.githubusercontent.com/alltomatos/allcode-release/main/changelog.json`.
7. `v1.27.4` já foi migrado para o feed público (12 assets).

Alternativas consideradas:

- **Feed genérico em CDN/R2** (`provider: "generic"` + domínio próprio): desacopla do GitHub, mas exige hospedar `latest*.yml` e assets, além de invalidação de cache.
- **Espelho automático** (workflow copia assets do repo privado para o público): mantém o publish no repo de código, mas adiciona um passo que pode falhar.
- **Repo público inteiro** (status anterior): simples, porém expõe código.

Recomendação mantida: repo privado + `allcode-release` público como feed.

Alternativas consideradas:

- **Feed genérico em CDN/R2** (`provider: "generic"` + `allcode.alltomatos.com/updates`): desacopla do GitHub, mas exige hospedar `latest*.yml`, assets e invalidação de cache; mais peças móveis.
- **Manter repo público só para releases via Espelho automático** (workflow que copia assets para `allcode-release`): mantém `publish` no repo privado e sincroniza; mais um passo que pode falhar.
- **Repo público inteiro** (status atual): simples, porém expõe código.

Recomendação: opção 1–3 (repo privado + `allcode-release` público como feed), com release publicando direto nele.

## Postura de segurança (checklist)

- Actions de terceiros fixadas por SHA (ok hoje).
- Workflows herdados do upstream devem manter guarda `if: github.repository == ...` para não rodar com secrets errados neste fork.
- Preferir `permissions:` explícito e mínimo em todo workflow; `contents: read` por padrão, `write` só onde publica.
- `pull_request_target` só é aceitável se **não** fizer checkout do código do PR; hoje `pr-standards` só usa API, `pr-management` está guardado ao upstream.
- Habilitar Dependabot (version + security updates) e revisar `bun audit` antes de releases grandes.
- Publicar npm com provenance quando o fluxo permitir (`--provenance` + `id-token: write`); token de publicação deve ser granular e restrito ao escopo `@alltomatos`.
- Nunca rodar `npm unpublish`/mudanças de dist-tag com token de CI sem OTP; use token dedicado.

## Playbooks rápidos

**Painel fora do ar**: `curl -I https://allcode.alltomatos.dev.br/login`; `bunx wrangler deployments list`; verificar migration pendente; rollback pelo dashboard Cloudflare.

**Release sem asset**: `gh run list --branch prod`; se `build` falhou, reexecutar `release-desktop` via `workflow_dispatch`; se `publish-release` falhou, rodar `gh release edit vX.Y.Z --draft=false --latest` manualmente.

**Updater parado**: `latest.yml`/`latest-mac.yml` precisa existir no release marcado como `latest`; conferir `channel` e repo no `electron-builder.config.ts`; releases draft são ignoradas pelo updater.
