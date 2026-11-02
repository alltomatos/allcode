<p align="center">
  <a href="https://github.com/alltomatos/allcode">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="OpenCode logo">
    </picture>
  </a>
</p>
<p align="center">OpenCode by Alltomatos — a fork of the open source AI coding agent.</p>
<p align="center">Grupo de Apoio: https://chat.whatsapp.com/DOLzfQ4aPZ12R7ZRbLabNh</p>

<p align="center">
  <a href="https://github.com/alltomatos/allcode/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/alltomatos/allcode?style=flat-square" /></a>
  <a href="https://github.com/alltomatos/allcode/actions"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/alltomatos/allcode/publish.yml?style=flat-square&branch=dev" /></a>
</p>

[![OpenCode Desktop](packages/web/src/assets/lander/screenshot-splash.png)](https://github.com/alltomatos/allcode)

---

### Screenshots

<p align="center">
  <img src="packages/web/src/assets/lander/t2.png" alt="Modos de permissão (Automático, Manual, Aceitar edições, Planejar)" width="49%">
  <img src="packages/web/src/assets/lander/config.png" alt="Tela de Configurações, com suporte a português" width="49%">
</p>

---

Este é um fork pessoal do [OpenCode](https://github.com/anomalyco/opencode), mantido por [Alltomatos](https://github.com/alltomatos), com o foco no app desktop para Windows e ajustes de UI/UX específicos deste fork (sidebar de projetos, terminal e browser embutidos no cabeçalho da sessão, seed de skills padrão, entre outros — veja o [changelog](./changelog.json) e as [releases](https://github.com/alltomatos/allcode/releases) para o histórico completo).

### Branches

Este fork trabalha com **uma branch de desenvolvimento** e releases por tag:

- **`dev`** — branch de desenvolvimento. Todo o trabalho novo (features, correções, UI/UX) acontece aqui.
- **`prod`** — congelada como snapshot histórico. Não recebe mais promoções e não dispara releases.
- **Release estável** — criada a partir de `dev` com uma tag anotada `vX.Y.Z`. O push da tag dispara os workflows de publicação.

### App Desktop (produção)

Baixe o instalador na [página de releases](https://github.com/alltomatos/allcode-release/releases/latest) — o feed público `alltomatos/allcode-release` hospeda os instaladores e os metadados do updater; o código-fonte fica no repositório privado.

| Plataforma       | Download                                  |
| ---------------- | ------------------------------------------ |
| Windows          | `allcode-desktop-win-x64.exe` (instalador NSIS) |
| macOS (Intel/ARM) | `allcode-desktop-mac-universal.dmg` |
| Linux (Debian/Ubuntu) | `allcode-desktop-linux-amd64.deb`      |
| Linux (Fedora/RHEL)   | `allcode-desktop-linux-x86_64.rpm`      |
| Linux (universal)     | `allcode-desktop-linux-x86_64.AppImage` |

No Windows, baixe e rode o `.exe` (instalador NSIS) — sem necessidade de script. No macOS e Linux, baixe o instalador correspondente e instale manualmente (`.dmg`, `dpkg -i *.deb`, `rpm -i *.rpm`, ou dê permissão de execução no `.AppImage`).

> **Nota (macOS):** os builds de Mac não são assinados/notarizados por este fork (não temos uma conta Apple Developer configurada). Na primeira abertura o Gatekeeper vai avisar que o app "não pode ser verificado" — clique com o botão direito no app → **Abrir** para liberar manualmente.

O app verifica atualizações automaticamente contra o feed público (`alltomatos/allcode-release`), não contra o projeto original nem contra o repositório de código.

### Rodando em desenvolvimento

Rode o app desktop localmente a partir da branch `dev`:

```bash
git clone https://github.com/alltomatos/allcode.git
cd allcode
git checkout dev
bun install
cd packages/desktop
bun run dev
```

Isso abre o Electron em modo desenvolvimento (canal `dev`, auto-update desativado, ícone de dev). Pra buildar um instalador local sem publicar:

```bash
cd packages/desktop
OPENCODE_CHANNEL=prod bun run build
bun run package:win     # Windows (feito manualmente nesta máquina)
bun run package:mac     # macOS — precisa rodar num Mac
bun run package:linux   # Linux — precisa de dpkg/rpm/fpm disponíveis
```

O instalador gerado fica em `packages/desktop/dist/`.

**Publicação real é automática**: ao empurrar uma tag anotada `vX.Y.Z` criada em `dev`, o workflow [`release-desktop.yml`](./.github/workflows/release-desktop.yml) dispara e builda Windows/macOS/Linux em paralelo (`windows-latest`/`macos-latest`/`ubuntu-latest`), publicando os três num único release do feed público `alltomatos/allcode-release`. A tag precisa bater com a versão de `packages/desktop/package.json`. Pra reexecutar manualmente (ex: retry de uma plataforma que falhou), use `gh workflow run release-desktop.yml`.

### CLI via npm (canais dev/prod)

Além do app desktop, o CLI deste fork é publicado direto no npm sob o escopo `@alltomatos`, separado dos pacotes `opencode-ai`/`@opencode-ai/*` do projeto original — instala com canal via a sintaxe `@tag` do próprio npm:

```bash
npm install -g @alltomatos/allcode@dev     # última publicada a cada push em dev
npm install -g @alltomatos/allcode@latest  # última publicada a cada tag vX.Y.Z
```

Publicação é automática pelo workflow [`release-npm-fork.yml`](./.github/workflows/release-npm-fork.yml): push em `dev` publica no canal `dev`; push de tag `vX.Y.Z` publica no canal `latest`. Útil pra testar mudanças de `dev` via CLI/servidor sem precisar instalar o app desktop.

### Memória entre sessões

Este fork adiciona um sistema de memória cross-sessão (global e por projeto), habilitado por padrão. O modelo tem acesso a duas tools sob demanda — `memory_search` (consulta memórias relevantes) e `memory_save` (registra algo pra lembrar depois) — chamadas quando o próprio modelo decide que é relevante, sem injetar tudo automaticamente em todo prompt.

- **Ativar/desativar e escolher modelo**: Configurações → Memória (mesmo padrão de toggle instantâneo do resto do app).
- **Memória global** (`~/.local/share/opencode/memory/global/`) fica disponível como skill carregada automaticamente em qualquer sessão/projeto, além de consultável via `memory_search`.
- **Memória por projeto** (`~/.local/share/opencode/memory/projects/<projeto>/`) fica isolada por diretório.

### Rodando numa VPS (servidor remoto)

O OpenCode também roda como servidor puro, sem o app desktop — útil pra manter sessões ativas 24/7 e acessar de qualquer lugar.

```bash
export OPENCODE_SERVER_PASSWORD="uma-senha-forte-aqui"
opencode web --hostname 0.0.0.0 --port 4096      # UI web embutida, acessível pelo navegador
# ou
opencode serve --hostname 0.0.0.0 --port 4096    # só a API, pra conectar via app desktop ou TUI
```

Depois é só adicionar esse endereço como servidor remoto em **Configurações → Servidores** no app desktop, ou abrir a URL direto no navegador. Guia completo (systemd, proxy reverso/TLS, segurança) em [`docs/vps-hosting.md`](./docs/vps-hosting.md).

**Bot do Telegram**: conecte em Configurações → Integrações → Telegram (token do @BotFather). Cada pedido roda em segundo plano; se um turno ficar travado (ex.: uma pergunta sem resposta) ele cancela sozinho depois de 10 minutos e avisa no chat — ou use `/cancel` pra cancelar na hora, sem precisar reiniciar o servidor. `/new` começa uma sessão nova a qualquer momento.

### Abas do app: Code e AgentUI

O app desktop organiza o trabalho em abas na barra lateral:

- **Code** — a aba padrão: sessões de codificação normais, com o agente OpenCode operando no seu projeto (terminal e browser embutidos, permissões, etc).
- **AgentUI** — construtor de agentes de chat próprios: configure um agente com system prompt, modelo e skills selecionadas, teste num sandbox de chat embutido, e habilite/desabilite por sessão. Editor baseado em páginas, direto na sidebar.

### Agents

OpenCode includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://opencode.ai/docs/agents) in the original project's docs.

### Documentation

A documentação de configuração geral segue a do projeto original: [opencode.ai/docs](https://opencode.ai/docs). Diferenças específicas deste fork (sidebar de projetos, seed de skills, canal de atualização, etc.) não estão documentadas lá — consulte o [changelog](./changelog.json) deste repositório.

---

## Créditos

Este fork existe graças ao trabalho da equipe original do **[OpenCode](https://github.com/anomalyco/opencode)** (anomalyco). Todo o núcleo do produto — o agente de codificação, a TUI, o protocolo, o SDK — vem do projeto original; este fork adiciona e ajusta principalmente a camada do app desktop.

- Projeto original: [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
- Site oficial: [opencode.ai](https://opencode.ai)
- Discord oficial: [opencode.ai/discord](https://opencode.ai/discord)

Se você não está procurando especificamente por este fork, use o [projeto original](https://github.com/anomalyco/opencode)

### Building on OpenCode

If you are working on a project that's related to OpenCode and is using "opencode" as part of its name, for example "opencode-dashboard" or "opencode-mobile", please add a note to your README to clarify that it is not built by the OpenCode team and is not affiliated with them in any way.
