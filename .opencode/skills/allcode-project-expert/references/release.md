# Release, versionamento e changelog

## Branches e gatilhos

- **`dev`** — branch padrão e única ativa; todo desenvolvimento entra aqui. Push em `dev` publica o canal de teste (`dev`).
- **`prod`** — congelada como snapshot histórico; não é mais promovida nem dispara release.
- **Release estável** — tag anotada `vX.Y.Z` criada no commit de release em `dev`. O push da tag dispara `release-npm-fork` (canal `latest`) e `release-desktop` (build 3 SOs + `publish-release`).
- A tag **precisa** bater com `packages/desktop/package.json`; os workflows falham se divergir.
- Artefatos e `changelog.json` vivem no repo público `alltomatos/allcode-release` (o repo de código é privado).

## Versionamento

Três trilhos independentes:

| Trilho | Pacotes | Como sobe |
|---|---|---|
| App/desktop/CLI | `packages/app`, `packages/desktop`, `packages/allcode` | mesma versão (`1.27.x`), bump manual nos três |
| Core/lib | `packages/core`, `llm`, `tui`, `ui`, `plugin`, etc. | `1.18.x` (fluxo upstream) |
| Portal | `packages/panel` | `bun run bump:minor|patch` em `packages/panel` (`0.4.x`) |

- Tags de release: **anotadas**, `vX.Y.Z`, criadas no commit de release.
- O npm publica com base em `packages/desktop/package.json`:
  - `prod`: versão exata (`1.27.4`)
  - `dev`: `1.27.4-dev.<run_number>`
- Se `allcode`/`app`/`desktop` divergirem, publique números inconsistentes. Sempre confira os três.

## Processo de release (tag a partir de `dev`)

1. Trabalho em `dev`, working tree limpo e `dev` sincronizada (`git fetch`, `git status`).
2. **Bump** em `packages/allcode`, `packages/app`, `packages/desktop` (mesmo número) e, se o portal mudou, `packages/panel` (independente).
3. **Changelog**: nova entrada em `changelog.json` (ver regras abaixo).
4. Validar: `bun run typecheck` por pacote, `bun test` por pacote, `bun run build` em `packages/app` (e `build:cloudflare` no painel se mudou).
5. Commit técnico + commit de release (`feat(release): vX.Y.Z - ...` ou `fix(release): ...`) e push de `dev`.
6. Validar o artefato dev (`release-npm-fork` publica `X.Y.Z-dev.N`; `npm view`/instalação).
7. Criar a tag anotada e empurrar: `git tag -a vX.Y.Z -m "vX.Y.Z"` + `git push origin vX.Y.Z`.
8. Acompanhar: `release-npm-fork` (publica `@latest`) e `release-desktop` (matrix 3 SOs + `publish-release` no repo `allcode-release`).
9. Validar: `npm dist-tag ls @alltomatos/allcode` (`latest` = versão nova) e `gh release view vX.Y.Z -R alltomatos/allcode-release` (draft=false, latest, assets `.exe/.dmg/.deb/.rpm/.AppImage`).

Requisito de infraestrutura: secret `RELEASE_TOKEN` (fine-grained PAT com `contents: write` em `alltomatos/allcode-release`), usado pelos jobs de desktop e pelo sync do `changelog.json`.

## Workflows

| Workflow | Gatilho | O que faz |
|---|---|---|
| `release-npm-fork.yml` | push `dev` + tags `v*`, manual | Build cross-platform do CLI e publica `@alltomatos/allcode` + 12 pacotes de plataforma. Push em `dev` → canal `dev`; tag `vX.Y.Z` → canal `latest`. |
| `release-desktop.yml` | tag `v*`, manual | Matrix Windows/macOS/Linux (`electron-builder --publish always`, canal `prod`) publicando em `allcode-release`, depois job **`publish-release`** que desfaz o draft, marca `--latest` e sincroniza `changelog.json`. |
| `release-desktop-dev.yml` | push `dev`, manual | Mesmo build no canal `dev` em `allcode-release`, versão `-dev.<run>`, app id separado (`ai.allcode.desktop.dev`). |
| `publish.yml` | push `dev`/`ci`/`beta` | Fluxo upstream (npm oficial/Tauri/AUR). **Skipped neste fork** por guarda de repositório. |
| `deploy.yml` | push `dev`/`production` | Deploy Cloudflare/stats do upstream. **Skipped** (guarda `anomalyco/opencode`). |
| `containers.yml` | mudanças em `packages/containers` | Build/push GHCR (`ghcr.io/alltomatos/...`). |
| `typecheck.yml`, `test.yml`, `nix-*`, `storybook.yml` | push/PR | Qualidade. |
| `notify-discord.yml` | release publicada | Webhook Discord (webhook opcional via `env`). |

Secrets usados: `NPM_TOKEN` (npm), `RELEASE_TOKEN` (publicar no feed público `allcode-release`), `GITHUB_TOKEN` (operações no repo de código). O restante é herdado do upstream e só faz sentido com guarda de repositório.

### Janela de propagação do npm

Após `npm publish`, o registry pode responder 404 por 1–2 minutos ("Your package is being processed"). Aguarde e reconsulte antes de considerar falha. Um `npm view` antigo pode vir de cache; use `--prefer-online` ou consulte `https://registry.npmjs.org/@alltomatos%2Fallcode` direto.

## Changelog

Arquivo: `changelog.json` na raiz. Formato:

```json
{
  "releases": [
    {
      "tag": "v1.27.4",
      "highlights": [
        { "source": "desktop", "items": [ { "title": "...", "description": "..." } ] }
      ]
    }
  ]
}
```

Regras:

- Mais recente primeiro; `source` sempre `desktop` neste fork.
- Texto em **pt-BR**, voltado ao usuário final, sem prefixos de commit.
- Geração assistida: `.opencode/command/changelog.md` + `script/changelog.ts` (gera `UPCOMING_CHANGELOG.md`) + `script/raw-changelog.ts` (coleta commits).
- **NUNCA incluir mudanças do portal/painel** (`packages/panel`): sem tenants, planos, revendas, trial, billing, admin portal, auditoria do portal. Se um commit é só de painel, pule. Se um item mistura desktop e portal, mantenha apenas o efeito no desktop.
- Seções permitidas: `Core`, `TUI`, `Desktop`, `SDK`, `Extensions` (só as que tiverem mudança notável). Correções em `### Bugfixes`, melhorias em `### Improvements`.
- Não inventar atribuição de comunidade; preserve apenas sufixos `(@user)` já existentes no input.

## Commits

`type(scope): summary` com `feat|fix|docs|chore|refactor|test`. Escopos usuais: `panel`, `app`, `desktop`, `core`, `tui`, `sdk`, `plugin`, `release`, `skills`. Exemplos reais:

- `fix(app): mount tenant provider sync under ServerSyncProvider`
- `feat(panel): add commercial plans and enforce seat limits`
- `fix(release): v1.27.4 - restore app startup`

Antes de commitar: `git status`, `git diff`, `git log --oneline -5`; stage só o que pertence ao escopo.

## Correção de release quebrada

- Sintoma: app não abre / erro de contexto / updater parado.
- Diagnóstico: comparar tags (`git diff vX..vY -- <arquivo>`), reproduzir local com backend+app dev, e usar `git tag --contains <commit>` para achar a primeira versão afetada.
- Correção: fix em `dev`, bump para a próxima versão (**não reutilize** número já publicado), changelog com entrada de correção, promover.
- Remoção de artefato quebrado: `npm unpublish` exige token **sem bypass 2FA** + OTP; releases/tags no GitHub via `gh release delete --cleanup-tag`. Não mova `latest` para trás se já existe uma versão corrigida.
