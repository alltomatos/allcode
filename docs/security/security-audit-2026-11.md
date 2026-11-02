# Auditoria de segurança — AllCode (nov/2026)

Escopo: repositório `alltomatos/allcode`, workflows de CI, artefatos publicados (npm/GitHub Releases), portal Cloudflare e cadeia de suprimentos.

## Resumo executivo

- Nenhum segredo real encontrado em arquivos versionados (apenas fixtures e placeholders).
- Ações de terceiros já estavam fixadas por SHA; `sha_pinning_required` foi habilitado.
- Dependências com vulnerabilidades conhecidas: **445 advisories (11 críticos)** no lockfile — remediation precisa ser faseada.
- O repositório estava **público** com código proprietário (portal SaaS). A recomendação é fechá-lo e publicar apenas artefatos em um repositório público de releases.
- O workflow `opencode.yml` aceitava comando de qualquer usuário em repositório público com segredo de API; restringido.
- O `notify-discord` estava inválido (segredo em `if` de job); corrigido.

## Achados

| # | Severidade | Achado | Status / recomendação |
|---|---|---|---|
| 1 | Alta | Repositório público expõe código do produto e do portal, incluindo regras comerciais (planos, trial, revendas) | Fechar o repo e mover releases/assets para `allcode-release` público |
| 2 | Alta | Lockfile com 11 vulnerabilidades críticas (ex.: `seroval`, `fast-xml-parser`, `tar`, `proxy-addr`, `tinypool`, `storybook`, `astro`) | Atualização faseada (`bun update` por grupo), priorizando runtime empacotado (`electron`, `seroval`, `tar`, `fast-xml-parser`) |
| 3 | Alta | `opencode.yml` disparava em `issue_comment` de qualquer usuário com `OPENCODE_API_KEY` + `id-token: write` | **Corrigido**: restrito a `OWNER`/`MEMBER`/`COLLABORATOR` |
| 4 | Média | `notify-discord.yml` usava `secrets` em `if` de job (workflow inválido, falhava sempre) | **Corrigido**: webhook em `env`, guarda `env.DISCORD_WEBHOOK != ''` |
| 5 | Média | `dependabot_security_updates` desabilitado e sem `dependabot.yml` | **Corrigido**: alerts + security updates habilitados; Dependabot semanal (bun + GitHub Actions) |
| 6 | Média | `actions/permissions`: `sha_pinning_required: false` | **Corrigido**: `sha_pinning_required: true` (todas as actions de terceiros já usam SHA) |
| 7 | Média | `SECURITY.md` era o do upstream (política "não aceitamos relatos gerados por IA", modelo de ameaça do OpenCode) | **Corrigido**: política do fork com canal privado e escopo |
| 8 | Média | `CODEOWNERS` apontava para mantenedores do upstream sem acesso ao repo | **Corrigido**: `* @alltomatos` |
| 9 | Média | `.gitignore` não cobria `.npmrc`, `.dev.vars`, `*.pem`, `*.p12`, `*.pfx` | **Corrigido** no `.gitignore` raiz |
| 10 | Média | Token npm de CI é granular com bypass 2FA: publica, mas não permite unpublish; se vazar, publica em `@alltomatos` | Rotacionar, restringir ao escopo e migrar para provenance/OIDC; nunca reutilizar token pessoal |
| 11 | Baixa | `pull_request_target` em `pr-standards.yml` com `pull-requests: write`; não faz checkout do PR | Aceitável; manter a regra de nunca executar código do PR nesse gatilho |
| 12 | Baixa | `deploy.yml` referencia segredos de Stripe/Sentry/Planetscale, mas está guardado a `anomalyco/opencode` | Manter a guarda; remover o workflow se não for usado |
| 13 | Baixa | Branch default no GitHub é `prod`, enquanto a convenção do repo é `dev` | Alterar default para `dev` |
| 14 | Baixa | Publicação npm sem `--provenance` | Avaliar `id-token: write` + provenance no workflow (validar que o registry aceita e não quebra o publish) |
| 15 | Info | Fixtures de teste contêm strings com formato de token (`sk-…`, `AIza…`) | Substituir por placeholders óbvios para reduzir ruído de scanners |
| 16 | Info | Secret scanning validity checks e non-provider patterns exigem GitHub Secret Protection (GHAS) | Indisponível no plano atual; reavaliar se houver GHAS |

## Evidências

- `bun audit` (antes): 445 vulnerabilidades (11 críticas, 166 altas, 215 moderadas, 53 baixas).
- `bun audit` (depois dos overrides): **349 vulnerabilidades (3 críticas, 130 altas, 176 moderadas, 40 baixas)**. As 3 críticas restantes são de `tinypool` (ferramenta de teste), que exige bump de major do vitest.
- `gh api repos/alltomatos/allcode`: `visibility: public`, `secret_scanning: enabled`, `push_protection: enabled`, `dependabot_security_updates: disabled` (antes da correção).
- Varredura de segredos em arquivos versionados: nenhum valor real; apenas fixtures e `.example`.

## Plano de remediação de dependências

Aplicado nesta rodada (overrides no `package.json` raiz, versões fixadas por segurança de release de 3 dias do Bun):

`seroval 1.7.5`, `tar 7.5.22`, `proxy-addr 2.0.8`, `fast-xml-parser 5.11.2`, `dompurify 3.4.17`, `follow-redirects 1.16.2`, `socket.io-parser 4.2.7`, `qs 6.17.1`, `electron 42.11.18`, `builder-util-runtime 9.7.1`, `fastify 5.12.7`, `happy-dom 20.14.6`, `astro 5.18.2`, `storybook 10.6.5`, `@storybook/addon-vitest 10.6.5`.

Pendente:

1. `tinypool` (3 críticas restantes) exige bump de major do vitest; avaliar em uma branch própria.
2. Itens de dev/docs de baixa prioridade (`esbuild`, `vite`, `brace-expansion` em múltiplos majors) devem ser tratados junto com upgrades de tooling.
3. Repetir `bun audit` e registrar o delta no próximo changelog interno.
