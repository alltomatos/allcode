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
| `/app/usuarios/:id` | Papel, suspender/reativar, remover, histórico |
| `/app/auditoria` | Eventos de autenticação e ações administrativas |
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
- Redefinição de senha por e-mail
- Contrato `/v1` consumido pelo AllCode Desktop
- Sessões e dispositivos por usuário no painel
