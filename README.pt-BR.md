# AllCode - Ambiente Inteligente de Engenharia de Software por Alltomatos

<p align="center">
  <h1 align="center">AllCode</h1>
  <p align="center"><strong>Plataforma Autônoma & Interativa de Desenvolvimento de Software com Agentes de IA</strong></p>
</p>

<p align="center">
  <a href="https://github.com/alltomatos/allcode/releases"><img alt="Último Release" src="https://img.shields.io/github/v/release/alltomatos/allcode?style=flat-square" /></a>
  <a href="https://github.com/alltomatos/allcode/actions"><img alt="Status do Build" src="https://img.shields.io/github/actions/workflow/status/alltomatos/allcode/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://chat.whatsapp.com/DOLzfQ4aPZ12R7ZRbLabNh"><img alt="Grupo WhatsApp" src="https://img.shields.io/badge/Comunidade-WhatsApp-25D366?style=flat-square&logo=whatsapp" /></a>
</p>

---

## 📌 Visão Geral

O **AllCode** é uma plataforma corporativa e open source focada na experiência de desenvolvimento assistido por agentes de IA. Desenvolvido para atuar com autonomia, segurança e máxima fidelidade ao código, o AllCode combina:
* Uma **aplicação Desktop unificada (Electron)** para Windows, macOS e Linux com paridade visual completa em relação ao cliente Web.
* Uma **interface de terminal moderna (TUI)** de altíssimo desempenho para desenvolvimento ágil via CLI.
* Um ecossistema de **coexistência pacífica (side-by-side)**, operando em porta dedicada (`1953`), diretórios isolados (`.allcode/`) e banco SQLite exclusivo (`allcode.db`), garantindo convivência harmoniosa sem qualquer conflito na máquina.

---

## 🚀 Diferenciais & Arquitetura do AllCode

### 1. Coexistência sem Conflitos (Side-by-Side)
Você pode manter o OpenCode original instalado e rodar o AllCode ao mesmo tempo:
* **Porta padrão do servidor:** `1953` (em vez de `4096`).
* **Configuração local do projeto:** pasta `.allcode/` com `allcode.json` ou `allcode.jsonc`.
* **Configuração global:** `~/.config/allcode/` (Windows: `%USERPROFILE%\.config\allcode`).
* **Banco SQLite isolado:** `allcode.db` (sem contenção de locks de escrita WAL).
* **Identificadores de SO:** Protocolo URL `allcode://` e App ID `ai.allcode.desktop`.

### 2. Migrador Integrado (`allcode import`)
Permite migrar seu histórico e configurações de outros ambientes sem risco:
* **`allcode import --opencode`**: Conecta em modo de leitura estrita (*read-only*) no `opencode.db` e copia com idempotência suas sessões, mensagens, ferramentas e a pasta `.opencode/` para o AllCode.

### 3. Memória Cross-Session Persistente
O AllCode retém decisões técnicas e diretrizes entre diferentes sessões:
* **Memória Global (`~/.local/share/allcode/memory/global`):** Regras de convenções de código e preferências do desenvolvedor válidas em todos os projetos.
* **Memória de Projeto (`~/.local/share/allcode/memory/projects/<projeto>`):** Fatos, decisões de arquitetura e contexto do repositório específico.
* As tools `memory_save` e `memory_search` operam sob demanda pelo raciocínio do modelo, evitando desperdício de tokens de contexto.

---

## 🖥️ A Experiência Desktop do AllCode (Foco Principal)

O aplicativo Desktop é a central de comando do desenvolvedor, projetado para máxima produtividade:

### A. Barra Lateral & Modos de Trabalho
* **Aba Code:** A visualização padrão de sessões de engenharia com a árvore de arquivos, histórico de conversas, diffs em tempo real e monitor de contexto.
* **Aba AgentUI:** Construtor visual de agentes de chat próprios. Permite configurar prompts de sistema, modelos dedicados e ferramentas específicas com sandbox interativo para testes antes do deploy.
* **Agendas & Rotinas (Schedule):** Disparador e monitor de tarefas periódicas automatizadas e lembretes com alertas no desktop.
* **Mídia & Estatísticas:** Dashboard analítico de consumo de tokens, custos por modelo e gerenciador de anexos.

### B. Painéis de Sessão Integrados (Header de Sessão)
* **Terminal PTY Integrado:** Terminal embutido com suporte a multiplexação, split e execução paralela de testes e comandos do sistema sem sair da tela do chat.
* **Navegador Live Integrado (Browser Panel):** Painel do Chromium incorporado diretamente na sessão para automação web, visualização de aplicações locais e depuração visual.
* **Revisão de Código (Diff Review):** Visualizador de diffs lado a lado (*split*) ou unificado (*inline*) com suporte a anotações linha a linha enviadas diretamente ao agente.
* **Dock de Interações:** Menus contextuais de decisão com opções de *Revert* seguro, *Follow-up queue* e aprovação de permissões sob demanda.

### C. Configurações Completas (Settings v2)
Acessível pelo atalho ou na barra lateral, organizada em três categorias:
1. **Desktop:**
   * **Geral:** Tema (Claro, Escuro ou Sistema), idioma, início automático no login, fechar para a bandeja do sistema (*tray*) e manutenção preventiva de banco de dados.
   * **Atalhos (Shortcuts):** Mapeamento customizável de todos os keybinds do teclado.
2. **Servidor:**
   * **Servidores:** Gerenciamento de servidores locais, túneis SSH remotos e máquinas WSL (Windows Subsystem for Linux) com sincronização e pareamento via QR Code.
   * **Provedores:** Conexão nativa com dezenas de provedores de IA (OpenAI, Anthropic, Google Vertex/Gemini, DeepSeek, Groq, Ollama, OpenRouter, etc.).
   * **Modelos:** Configuração de limites de saída, esforço de raciocínio (thinking/effort) e modelos favoritos.
   * **Combos:** Cadeias de modelos com estratégias de fallback automático, roteamento balanceado ou otimização de custo/latência.
3. **Customização:**
   * **Skills:** Gerenciamento, habilitação e instalação de skills de agentes locais e do GitHub.
   * **Memória:** Configuração do modelo extrator de memória e consulta ao histórico persistido.
   * **MCP (Model Context Protocol):** Conexão com servidores MCP locais (stdio) ou remotos (HTTP/SSE) com OAuth.
   * **Integrações:** Conexão de bots headless com Telegram e WhatsApp para controle remoto.
   * **Agentes Externos:** Orquestração de CLIs externos como workers assistentes.

---

## 🌐 Paridade Web & Servidor Remoto (Headless)

O AllCode foi desenhado sob o princípio de **Paridade Absoluta**: a interface gráfica web servida pelo servidor possui o mesmo design system, atalhos e capacidades do aplicativo Desktop:

### Executando em uma VPS ou Servidor Remoto
Mantenha seus agentes rodando 24 horas por dia em uma máquina remota:
```bash
export ALLCODE_SERVER_PASSWORD="sua-senha-segura-aqui"

# Iniciar com interface Web completa acessível pelo navegador na porta 1953:
allcode web --hostname 0.0.0.0 --port 1953

# Ou iniciar apenas a API do daemon para conectar pelo app Desktop ou TUI:
allcode serve --hostname 0.0.0.0 --port 1953
```
No app Desktop, basta ir em **Configurações → Servidores → Adicionar Servidor** e inserir `http://seu-ip:1953` (ou usar o assistente automático de túnel SSH).

---

## 💻 Instalação

### Aplicativo Desktop (Recomendado)
Baixe o instalador oficial diretamente na [Página de Releases](https://github.com/alltomatos/allcode/releases/latest):
* **Windows:** `allcode-desktop-win-x64.exe` (Instalador NSIS com atalho na bandeja).
* **macOS:** `allcode-desktop-mac-arm64.dmg` (Apple Silicon) / `allcode-desktop-mac-x64.dmg` (Intel).
* **Linux:** `allcode-desktop-linux-x64.deb` (Debian/Ubuntu), `.rpm` (Fedora/RHEL) ou `.AppImage` (Universal).

### CLI via npm
```bash
# Versão estável
npm install -g @alltomatos/allcode@latest

# Versão de desenvolvimento contínuo (tracking dev branch)
npm install -g @alltomatos/allcode@dev
```

### Rodando a Interface de Terminal (TUI)
Para programar diretamente pelo terminal com máxima velocidade:
```bash
# Iniciar a TUI no diretório atual
allcode

# Continuar a última sessão ativa
allcode --continue

# Conectar a TUI a um servidor remoto em execução
allcode attach http://localhost:1953
```

---

## 🛠️ Ambiente de Desenvolvimento Local

Para clonar e compilar o AllCode na sua máquina:
```bash
git clone -b dev https://github.com/alltomatos/allcode.git
cd allcode
bun install

# Rodar a TUI interativa em desenvolvimento
bun dev

# Rodar o App Desktop Electron em modo desenvolvimento
bun dev:desktop

# Validar compilação e tipagem de todo o monorepo
bun turbo typecheck
```

---

## 👥 Créditos & Agradecimentos

O AllCode é desenvolvido e mantido por **Alltomatos**. O projeto tem raízes na excelente base arquitetural e nos protocolos de agentes criados pela equipe do **[OpenCode](https://github.com/anomalyco/opencode)** (`anomalyco`), expandindo a plataforma com foco dedicado no aplicativo desktop, coexistência estrita, orquestração profunda, integração de mensageria e ferramentas avançadas de desenvolvimento.
