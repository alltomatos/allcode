# Mapa do fork alltomatos/opencode

**Última verificação:** 2026-10-30 (versões: fork `1.26.2` — releases de tenant audit, RBAC, e antigravity resiliência). Este arquivo é um cache leve — os fatos abaixo (versões, quem está à frente de quem) mudam com o tempo. Se a pergunta depender de um número exato e atual (versão publicada agora, quantos commits de diferença), confirme ao vivo (ver seção final) antes de responder como definitivo.

## Remotes

- `origin` → `https://github.com/alltomatos/opencode.git` (este fork)
- `upstream` → `https://github.com/anomalyco/opencode.git` (projeto original)

Nem sempre já configurados: em clones frescos (ex.: sessões remotas/cloud, containers efêmeros) o remote `upstream` costuma não existir — rode `git remote add upstream https://github.com/anomalyco/opencode.git && git fetch upstream` antes de qualquer comparação. Não assuma que já está lá só porque uma sessão anterior configurou.

## Branches e o que cada um é

| Branch | Propósito |
| --- | --- |
| `prod` | **Única** branch que gera release publicado. `.github/workflows/release-desktop.yml` dispara automaticamente em todo push nessa branch, builda Windows/macOS/Linux em paralelo via GitHub Actions, publica um release (draft) no GitHub com os três instaladores + arquivos `latest*.yml` do auto-updater. |
| `dev` | Branch de desenvolvimento normal. Recebe trabalho novo antes de ser promovido pra `prod`. |
| `breniac` | Feature branch pro assistente de voz Breniac (ver `docs/prd/breniac-voice-assistant.md` na própria branch — o PRD só existe lá, não em `dev`/`prod` ainda). |

**Padrão de promoção:** commits de uma feature branch (`breniac`) só vão pra `dev`/`prod` quando o usuário explicitamente pede ("promova pra dev", "leva isso pra produção"). Commits específicos de uma feature branch nem sempre se aplicam limpos nos outros branches. **Sempre confira se o commit toca arquivos que só existem na branch de origem antes de propagar** — cherry-pick seletivo (só os commits que fazem sentido) é o padrão aqui, não merge cego da branch inteira.

## O que é exclusivo deste fork (não existe no upstream)

- **Batuta** *(Descontinuado)*: Feature legada de orquestração multi-agente, removida da codebase ativa.
- **Breniac** (assistente de voz conversacional, foco em acessibilidade — na branch `breniac`):
  - PRD completo: `docs/prd/breniac-voice-assistant.md` (só nessa branch)
  - Rotas HTTP próprias: `packages/opencode/src/server/routes/instance/httpapi/{handlers,groups}/breniac.ts`
  - UI: `packages/app/src/components/breniac/`, `packages/app/src/context/breniac.tsx`
  - Escopo atual (definido no próprio PRD): desktop only, sem wake-word, sem mobile — ver `docs/prd/mobile-app.md` pra proposta de estender isso.
- **App Desktop (Electron)** — todo `packages/desktop/` é deste fork (upstream não tem app desktop Electron próprio nesse formato). Diferenciais recentes: botão "Abrir DevTools" e toggle "Modo debug" (Configurações → Avançado, habilita porta CDP remota mesmo em build empacotado), versão visível na sidebar (abaixo de "Ajuda").
- **Branding**: nome do app, ícones, changelog (`changelog.json` na raiz, em português) são deste fork.

## Processo de release (app desktop) — automatizado, não manual

Isto substitui qualquer nota antiga dizendo que o build/publish é manual — **não é mais**, desde que `.github/workflows/release-desktop.yml` foi criado neste fork:

1. Version bump em `packages/desktop/package.json`, `packages/app/package.json` e `packages/allcode/package.json` (os três andam juntos no fork; `packages/cli`, `packages/sdk/js` e `packages/codemode` seguem o versionamento do upstream em `1.18.21`).
2. Entrada nova no topo de `changelog.json` (formato: array `releases`, cada um com `tag` e `highlights[].items[]`, em português).
3. Commit + push em `dev` (o push já dispara `release-desktop-dev.yml`, que publica o canal `dev` como `<versão>-dev.<run_number>`).
4. Promoção: `git push origin dev:prod` — `prod` não é protegido e o histórico é linear, então o push é fast-forward e **cria o release sozinho** (sem merge commit manual).
5. O push em `prod` dispara `release-desktop.yml`: builda os 3 SOs em paralelo (~10min) e o job final `publish-release` **tira o release do draft e marca como `latest` automaticamente** — não precisa mais `gh release edit --draft=false` na mão (o workflow faz isso desde que o job `publish-release` foi adicionado).
6. Verificar com `gh run list --repo alltomatos/allcode --workflow=release-desktop --branch=prod --limit=1` e `gh release view v<versão> --repo alltomatos/allcode`.

**Antes de fazer push em qualquer branch**, o hook de pre-push roda `bun turbo typecheck` no monorepo inteiro — não pule isso, é rápido (~10-50s com cache) e pega erro de tipo entre pacotes que só aparece na integração.

**Se for propagar pra um worktree novo** (`git worktree add /tmp/xxx <branch>`), lembre que ele não vem com `node_modules` — rode `bun install` lá antes do push (senão o hook de typecheck falha por falta de dependências, não por erro real).

**Falhas pré-existentes (não são regressão):** o workflow `notify-discord` está falhando em todo push (webhook do Discord quebrado/ausente), e `packages/core` tem 4 testes falhando na branch `dev` (migração de config v1→v2 com `failover.strategy: "priority-round-robin"`, `ModelsDev` exigindo rede, resolução de `/usr/bin/bash` no Git Bash e `cross-spawn` capturando stdout).

## Convenções de commit e branch neste fork

- Nunca trabalhar direto em `prod` — sempre promover de `dev`/`batuta`/`breniac` via cherry-pick ou merge.
- Mensagens de commit em inglês, seguindo `tipo(escopo): resumo` (`fix(desktop):`, `feat(app):`, `docs:`, `chore(release):`), com corpo explicando o *porquê*, não só o *o quê* — este fork usa `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` no rodapé quando a mudança foi feita por IA.
- `docs/` na raiz é onde ficam documentos deste fork que não são upstream (PRDs em `docs/prd/`, guias como `docs/vps-hosting.md`). Não confundir com `packages/web/src/content/docs/` — esse é o site Starlight herdado do upstream (`opencode.ai/docs`), cujas mudanças não necessariamente ficam visíveis pra usuários deste fork (o README avisa que a documentação "oficial" seguida é a do projeto original).

## Verificar se este cache está desatualizado

Antes de responder algo que dependa de estado atual exato, rode:

```bash
git fetch origin upstream
git branch -r | grep -E "origin/|upstream/(dev|main)$"   # confirma que as branches acima ainda existem com esses nomes
git log -1 --format="%H %ci" origin/prod                  # última versão publicada
grep '"version"' packages/desktop/package.json             # versão local atual
```

Se algo aqui não bater com o que está descrito acima, atualize este arquivo (não só responda o usuário e siga em frente — o próximo a usar esta skill vai herdar a informação errada se você não corrigir).
