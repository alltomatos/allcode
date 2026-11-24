# @allcode/panel

Painel SaaS do AllCode: landing pública, login e área do gestor para criar, suspender e remover usuários que usam o AllCode Desktop.

## Rodando

```bash
bun install
bun run --cwd packages/panel dev
```

Abre em `http://localhost:3003`.

Credenciais de desenvolvimento (seed automático):

```
admin@allcode.dev / allcode123
```

Variáveis de ambiente:

| Variável | Padrão | Uso |
|---|---|---|
| `PANEL_SESSION_SECRET` | segredo de dev (32+ chars) | assinatura do cookie de sessão |
| `PANEL_ADMIN_EMAIL` | `admin@allcode.dev` | e-mail do proprietário inicial |
| `PANEL_ADMIN_PASSWORD` | `allcode123` | senha do proprietário inicial |

## Build e preview

```bash
bun run --cwd packages/panel build
node packages/panel/.output/server/index.mjs
```

No Windows, use build + preview: o worker de dev do Nitro ainda usa socket Unix e não sobe no `vite dev`. Em Linux/macOS/WSL o `dev` funciona normalmente.

## Rotas

| Rota | Descrição |
|---|---|
| `/` | Landing pública |
| `/login` | Login do gestor |
| `/app` | Visão geral |
| `/app/usuarios` | Lista, busca e status |
| `/app/usuarios/novo` | Cria usuário com senha temporária |
| `/app/usuarios/:id` | Visão geral, uso de modelos, sessões e aba de configurações (papel, senha e RBAC) |
| `/app/sessoes/:id` | Detalhes de uma sessão: resumo completo, KPIs, tokens e modelos usados |
| `/app/auditoria` | Sessões de IA (resumos executivos, filtros e KPIs) e eventos de segurança |
| `/app/configuracoes` | Políticas da organização (owner) |

## Deploy na Cloudflare

Pré-requisitos: `alltomatos.dev.br` como zona ativa na conta Cloudflare e autenticação do Wrangler.

```bash
cd packages/panel
bunx wrangler login

# banco D1: crie uma vez e copie o database_id para wrangler.jsonc
bunx wrangler d1 create allcode-panel

# segredos de produção
bunx wrangler secret put PANEL_SESSION_SECRET   # 32+ caracteres
bunx wrangler secret put PANEL_ADMIN_PASSWORD

bun run deploy
```

O `deploy` compila com o preset `cloudflare-module`, aplica as migrações D1 no remoto e publica o worker `allcode-panel` com custom domain `allcode.alltomatos.dev.br`, assets em `.output/public` e binding `ASSETS`.

Para testar o worker localmente com o runtime da Cloudflare e D1 local:

```bash
bun run build:cloudflare
bun run db:migrate:local
bunx wrangler dev
```

## Produção

- URL: https://allcode.alltomatos.dev.br
- Worker: `allcode-panel` (conta Cloudflare `1eef7cdafc999121e4e815e206bd32ec`)
- D1: `allcode-panel` (`da2843cf-1acc-4c83-97d5-adf70ae35cbb`, região WEUR)
- Segredos: `PANEL_SESSION_SECRET`, `PANEL_ADMIN_EMAIL`, `PANEL_ADMIN_PASSWORD`, `PANEL_PASSWORD_PEPPER`

O usuário proprietário é criado no primeiro acesso (seed). Trocar `PANEL_ADMIN_PASSWORD`
depois disso **não** altera a senha já gravada; remova a linha em `panel_user` para
re-semear ou implemente a tela de troca de senha. O `PANEL_PASSWORD_PEPPER` é aplicado
no hash: rotacioná-lo invalida as senhas existentes.

## Persistência

O runtime usa D1 quando o binding `DB` existe (`env.DB`) e cai para memória no preview em Node. As migrações ficam em `migrations/` e são aplicadas com `wrangler d1 migrations apply`.

**Onde fica cada dado (confirmado no código):**

| Dado | Onde | Acesso |
|---|---|---|
| Usuários, e-mail, `password_hash`, `is_platform_admin`, `status` | **Cloudflare D1** (`allcode-panel`), tabela `panel_user` | binding `DB` (`store()` em `src/lib/store.ts`) |
| Auditoria lida pelo painel (`/app/auditoria`) | **Cloudflare D1**, tabela `audit_event` | `store().audit.log` |
| Sessões/KPIs e espelho de auditoria | **PostgreSQL na VPS** (`allcode_audit`), tabelas `session_audit` e `audit_event` | Hyperdrive `AUDIT_DB` ou `AUDIT_PG_URL` (`src/lib/audit-db.ts`) |

Ou seja: **a credencial do administrador geral não está no PostgreSQL da VPS**. Um `UPDATE` em `psql` não restauraria o login — o registro correto é `panel_user` no D1. O PostgreSQL da VPS é usado apenas como espelho de auditoria/sessões. Nenhuma credencial de banco vai para o bundle do frontend: `store()` só lê `bindings().DB` no Worker.

## Recuperação de acesso do administrador geral (break-glass)

### Fluxo de autenticação

`src/lib/actions.ts` → `login`: `findByEmail(email)` em `panel_user` → `verifyPassword()` → `canAccessPortal()` → `usePanelSession().update({ userID })` → redirect `/4dm1n` quando `is_platform_admin`. O middleware (`src/middleware.ts`) guarda `/app`, `/4dm1n` e `/revenda`.

Hash (`src/lib/crypto.ts`): **PBKDF2-SHA256, 100.000 iterações, 256 bits, salt de 16 bytes**, formato `pbkdf2$sha256$100000$<base64-salt>$<base64-hash>`. Antes do PBKDF2, a senha passa por **HMAC-SHA256 com `PANEL_PASSWORD_PEPPER`** (base64 da assinatura), quando o segredo existir. O administrador geral é `ronaldodavi@gmail.com`, marcado com `is_platform_admin = 1` por `migrations/0002_platform_admin.sql` e reforçado pelo seed.

### Diagnóstico do bloqueio

- **Não existe rate-limit nem travamento por tentativas** no código. Falhas de login geram apenas evento de auditoria e retornam mensagem genérica; o bloqueio não vem de tentativas excessivas. (Se houver regra de WAF/Rate Limiting no dashboard da Cloudflare, verifique lá — fora do repositório.)
- A mensagem ao navegador é propositalmente genérica (`login.invalid`) para não enumerar contas. Agora a **auditoria distingue o motivo**: `auth.login_failed_unknown_account`, `auth.login_failed_bad_password`, `auth.login_failed_hash` (hash em formato incompatível) e `auth.login_failed_disabled`.
- Causas prováveis, em ordem: senha incorreta; **`PANEL_PASSWORD_PEPPER` rotacionado/diferente** (invalida todos os hashes); `PANEL_ADMIN_PASSWORD` alterado no secret sem re-semear; conta com `status = suspended|deleted`; ou `canAccessPortal` negando acesso.
- **"Esqueci minha senha" existe mas está desabilitado**: `/recuperar-senha` tem botão `disabled` e envio de e-mail não implementado. A tela agora orienta a contactar o administrador da plataforma.
- O reset pela UI (`resetUserPassword`) proíbe `actor.id === id`, por isso o próprio administrador bloqueado não consegue se redefinir sozinho — daí o procedimento fora da aplicação.

### Pré-requisitos (variáveis de ambiente, nunca versionadas)

| Variável | Uso |
|---|---|
| `CLOUDFLARE_API_TOKEN` | token de API com permissão **D1:Edit** na conta |
| `CLOUDFLARE_ACCOUNT_ID` | id da conta Cloudflare |
| `D1_DATABASE_ID` | opcional; se ausente, lido de `wrangler.jsonc` |
| `PANEL_PASSWORD_PEPPER` | **exatamente** o mesmo valor configurado no Worker (`wrangler secret put`). Obrigatório, a menos que se use `--assume-no-pepper` |
| `PANEL_RESET_OPERATOR` | quem executa a ação (e-mail/nome), gravado na auditoria |
| `PANEL_ADMIN_EMAIL` | opcional; padrão `ronaldodavi@gmail.com` |
| `PANEL_RESET_NEW_PASSWORD` | opcional; senha forte já gerada no cofre. Se ausente, o script gera e exibe uma única vez em terminal interativo |
| `AUDIT_PG_URL` | opcional; string de conexão do `allcode_audit` na VPS para espelhar a auditoria |

Nenhuma dessas variáveis é escrita em arquivo, log ou commit. O script roda via Bun no terminal do operador e **não** é importado pelo frontend.

### Procedimento

```powershell
cd packages\panel

$env:CLOUDFLARE_ACCOUNT_ID  = "<id da conta>"
$env:CLOUDFLARE_API_TOKEN   = "<token com permissão D1:Edit>"
$env:PANEL_RESET_OPERATOR   = "ronaldodavi@gmail.com"

# 0) Diagnóstico SOMENTE LEITURA: não exige pepper, não exige senha, não altera nada.
#    Mostra status da conta, formato do hash e os últimos eventos de login auditados.
bun run admin:reset-password --diagnose

# 1) Descubra se o Worker de produção usa pepper (lista NOMES, nunca valores):
bunx wrangler secret list
```

**Decisão do pepper** (o script aborta de propósito se ele estiver indefinido — gravar hash com pepper errado manteria a conta bloqueada em silêncio):

| `wrangler secret list` | Ação |
|---|---|
| `PANEL_PASSWORD_PEPPER` **ausente** | rode com `--assume-no-pepper` |
| `PANEL_PASSWORD_PEPPER` **presente** | exporte `$env:PANEL_PASSWORD_PEPPER` com **exatamente** o mesmo valor guardado no cofre (Cloudflare não deixa ler o valor de volta) |
| Valor irrecuperável | use o **fallback de re-seed** abaixo (o hash é calculado dentro do Worker, sem precisar do pepper) |

Se `--diagnose` mostrar repetidos `auth.login_failed_bad_password` com hash em formato válido, é forte indício de **pepper divergente** — justamente a causa provável do bloqueio.

```powershell
# 2) Validação sem efeito colateral
bun run admin:reset-password --dry-run --operator "ronaldodavi@gmail.com"   # acrescente --assume-no-pepper se aplicável

# 3) Execução
bun run admin:reset-password --operator "ronaldodavi@gmail.com"             # mesma flag, se aplicável
```

O script, nesta ordem: (1) valida config e conexões **antes** de alterar; (2) confirma que a conta existe, é `is_platform_admin = 1` e não está suspensa; (3) gera senha temporária forte e aplica **o mesmo `hashPassword` da aplicação**; (4) confere `verifyPassword` localmente; (5) faz `UPDATE` **parametrizado** via API do D1 (`sql` + `params`, sem interpolação); (6) registra auditoria em `audit_event` no D1 e, se `AUDIT_PG_URL` estiver definido, também no PostgreSQL da VPS com query parametrizada; (7) relê o hash e confirma a persistência. Qualquer falha aborta com mensagem clara e `exit 1`. A ação é auditada como `user.password_reset_breakglass` com conta afetada, operador e horário, e marca `must_change_password = 1`.

A senha temporária é exibida **uma única vez** no terminal interativo (nunca em log, arquivo ou repositório). Em execução não interativa, defina `PANEL_RESET_NEW_PASSWORD` — nesse caso o script não imprime segredo algum.

### Validar o login

1. Acesse https://allcode.alltomatos.dev.br/login.
2. Entre com `ronaldodavi@gmail.com` e a senha temporária.
3. Confirme o redirect para `/4dm1n` (administrador geral) e o evento `user.password_reset_breakglass` em `/app/auditoria`.
4. Troque a senha imediatamente (`must_change_password = 1`).
5. Se o login ainda falhar com `Credenciais inválidas.`, o `PANEL_PASSWORD_PEPPER` usado no script divergiu do Worker: repita o procedimento com o valor correto ou use o fallback abaixo. A auditoria agora indica `auth.login_failed_bad_password` vs `auth.login_failed_hash`.

### Caminho recomendado: re-seed via Wrangler (sem precisar do pepper)

`PANEL_PASSWORD_PEPPER` é um secret **write-only** — a Cloudflare não devolve o valor. Quando ele existe em produção mas não está no cofre do operador, use `admin:reseed`: ele usa apenas a autenticação **OAuth já configurada do Wrangler** (não exige `CLOUDFLARE_API_TOKEN`) e deixa o próprio Worker calcular o hash com o pepper correto.

```powershell
cd packages\panel
$env:PANEL_RESET_OPERATOR = "ronaldodavi@gmail.com"
bunx wrangler whoami            # confirma a conta certa
bun run admin:reseed --dry-run --operator "ronaldodavi@gmail.com"
bun run admin:reseed       --operator "ronaldodavi@gmail.com"
```

Como funciona (`script/reseed-admin-password.ts`):

1. Pré-valida no D1: conta existe, `is_platform_admin = 1`, `status = active` e **exatamente um** administrador geral.
2. Gera senha temporária forte e a exibe **uma única vez** no início (para não se perder se algo falhar).
3. `wrangler secret put PANEL_ADMIN_PASSWORD` via stdin — cria uma nova versão do Worker, sem gravar o valor em arquivo, log ou repositório.
4. Renomeia o e-mail da conta para um valor temporário (não usa `DELETE`), disparando `ensureSeed()` (`src/lib/store.ts:1682`), que insere uma linha nova com `hashPassword(seedPassword())` **dentro do Worker**, onde `PANEL_PASSWORD_PEPPER` está disponível.
5. Usa `POST /api/v1/auth/login` como **oráculo**: só aceita o hash se a senha temporária autenticar com `isPlatformAdmin = true`. Repete o ciclo até isso acontecer — isso contorna o race de propagação da versão do Worker (um isolate antigo pode semear com a senha anterior).
6. Copia o hash validado para a linha **original**, preservando `id`, `org_id`, flags e `created_at`; remove a linha temporária; restaura o e-mail; marca `must_change_password = 1`.
7. **Rollback completo** (e-mail + hash + flag originais) em qualquer falha, e auditoria `user.password_reset_breakglass` (conta, operador, horário) no D1 — mais espelho no PostgreSQL da VPS se `AUDIT_PG_URL` estiver definido.

Ao final, valida de verdade via `POST /api/v1/auth/login` e confere `id`, permissões, unicidade do admin e ausência de registros temporários. Exige que `PANEL_ADMIN_EMAIL` de produção seja `ronaldodavi@gmail.com` (verificável indiretamente: só existe um platform admin, criado pelo seed).

> Efeito colateral esperado: `PANEL_ADMIN_PASSWORD` passa a conter a senha temporária (é um secret do Worker, não texto plano no repo). Os demais usuários **não** são afetados — o pepper não é rotacionado.
>
> Não use o `DELETE` manual direto: ele perde o `id` da conta e referências de auditoria. Use sempre o script.

### Repetindo e higiene

- O procedimento é idempotente o suficiente para ser repetido: cada execução valida antes, gera novo hash e grava novo evento de auditoria.
- Rotacione a credencial do PostgreSQL que estava **hardcoded** em `script/migrate-d1-to-pg.ts` (agora removida; o script lê `AUDIT_PG_URL`). A rotação deve ser feita na VPS/Docker secret, nunca neste repositório.
- `tail.log`, `probe.json` e `d1-clean.json` são artefatos locais ignorados pelo `.gitignore`; não commite dumps de logs ou backups.
- Se o PostgreSQL da VPS não tiver partição de `audit_event` para o mês corrente, rode `init-audit-schema.sql` antes — o script avisa com erro claro.

## Troca de senha do próprio usuário

A rota canônica é `POST /api/v1/auth/change-password` (usada pelo AllCode Desktop em `packages/app/src/components/account-modal.tsx`). Ela recebe `{ userId, currentPassword, newPassword }`, e a lógica real vive em `src/lib/password-change.ts` (`changePassword` / `verifyCredentials`), compartilhada com `POST /api/v1/auth/login`.

Garantias implementadas:

- `d1Store.users.update` usa `UPDATE ... WHERE id = ?`, grava `updated_at`, exige **`meta.changes === 1`** e lança erro se o UPDATE não afetar exatamente uma linha.
- `changePassword` **relê o registro** após o UPDATE e confirma com `verifyPassword` que: a nova senha autentica, a anterior é rejeitada e `must_change_password = 0`. Só então registra `auth.password_changed` com `result = 'allow'`. Uma escrita não confirmada retorna erro 500 em vez de um `ok: true` enganoso.
- `store()` é **fail-closed**: no Worker (`globalThis.__env__` presente) a ausência do binding D1 `DB` lança erro em vez de cair no `memoryStore`. Isso impede que `PANEL_ADMIN_PASSWORD` (usado apenas pelo seed em memória) atue como credencial de autenticação e que escritas privilegiadas sejam descartadas.
- A coluna `updated_at` vem de `migrations/0016_password_updated_at.sql` (aplicar com `bun run db:migrate:remote` antes de publicar).
- A resposta da rota envia `Cache-Control: no-store`. O cookie `panel_session` guarda apenas `userID` (não há hash em cache), e o desktop reautentica via `POST /api/v1/auth/login`, que agora usa `verifyCredentials` sobre o mesmo D1 — painel e desktop convergem.
- Teste de regressão de integração: `test/password-change.test.ts` (D1 real sobre `bun:sqlite`, sem mocks em `globalThis`), cobrindo troca → nova senha autentica → temporária rejeitada → `must_change_password = 0` → `updated_at` → evento `allow` → desktop e painel concordam, além dos casos de senha atual incorreta e escrita não confirmada.

> Atenção: o botão **"Redefinir senha"** de `/app/usuarios/:id` chama `resetUserPassword` e altera **o usuário alvo**, não o operador (a action proíbe `actor.id === id`). Para trocar a própria senha, use o modal de conta do Desktop ou a rota acima. O painel ainda não expõe um formulário de troca própria — não use "Redefinir senha" de outra conta esperando afetar a sua.

### Verificar antes e depois de uma troca

```bash
bunx wrangler d1 execute allcode-panel --remote --config wrangler.jsonc --json \
  --command "SELECT id, substr(password_hash,1,26) AS hash_prefix, must_change_password, updated_at, last_login_at FROM panel_user WHERE email = 'ronaldodavi@gmail.com'"
```

O `hash_prefix` deve mudar, `must_change_password` deve virar `0` e `updated_at` deve ser preenchido. Confirme também o evento próprio:

```bash
bunx wrangler d1 execute allcode-panel --remote --config wrangler.jsonc --json \
  --command "SELECT action, result, actor_email, target_id, at FROM audit_event WHERE action = 'auth.password_changed' ORDER BY at DESC LIMIT 3"
```

Se `AUDIT_PG_URL` estiver configurado, espelhe esse evento no PostgreSQL da VPS (query parametrizada, sem expor a string de conexão):

```bash
bun -e 'import postgres from "postgres"; const sql = postgres(process.env.AUDIT_PG_URL, { max: 1, ssl: { rejectUnauthorized: false } }); const e = { orgID: "org_default", actorEmail: "ronaldodavi@gmail.com", targetID: "13b692cf-9f7e-48d4-9726-be1d67ab8757", at: new Date().toISOString() }; await sql`INSERT INTO audit_event (org_id, actor_id, actor_email, action, target_type, target_id, result, at) VALUES (${e.orgID}, ${null}, ${e.actorEmail}, ${"auth.password_changed"}, ${"user"}, ${e.targetID}, ${"allow"}, ${e.at}::timestamptz)`; await sql.end(); console.log("espelho registrado")'
```

## Testes

```bash
bun test
```

## Estado atual

Primeiro slice funcional:

- Sessão em cookie `HttpOnly` (h3 `useSession`), guard por middleware em `/app/*`
- Senhas com PBKDF2-SHA256 (100k iterações, limite do WebCrypto da Cloudflare) + pepper HMAC
- RBAC fixo: `owner`, `admin`, `member`
- Persistência D1 (organização, usuários e auditoria) com fallback em memória
- Auditoria de login, criação, papel, suspensão e remoção
- i18n `pt-BR`, `en`, `es`

Ainda não implementado:

- Provedor de identidade externo (OIDC/SSO) — o login local existe só para o slice inicial
- Redefinição de senha por e-mail (enquanto isso, use o procedimento break-glass acima)
- Contrato `/v1` consumido pelo AllCode Desktop
- Sessões e dispositivos por usuário no painel
