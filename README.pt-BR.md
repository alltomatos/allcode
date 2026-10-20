# AllCode - Plataforma de Soluções e Automações Corporativas por Alltomatos

<p align="center">
  <h1 align="center">AllCode</h1>
  <p align="center"><strong>Plataforma Autônoma & Interativa de Desenvolvimento de Soluções e Automações Corporativas com Agentes de IA</strong></p>
</p>

<p align="center">
  <a href="https://github.com/alltomatos/allcode/releases"><img alt="Último Release" src="https://img.shields.io/github/v/release/alltomatos/allcode?style=flat-square" /></a>
  <a href="https://github.com/alltomatos/allcode/actions"><img alt="Status do Build" src="https://img.shields.io/github/actions/workflow/status/alltomatos/allcode/publish.yml?style=flat-square&branch=dev" /></a>
  <a href="https://chat.whatsapp.com/DOLzfQ4aPZ12R7ZRbLabNh"><img alt="Grupo WhatsApp" src="https://img.shields.io/badge/Comunidade-WhatsApp-25D366?style=flat-square&logo=whatsapp" /></a>
</p>

---

## 📌 Visão Geral & Propósito Corporativo

O **AllCode** é uma plataforma corporativa e open source desenhada para o **desenvolvimento de soluções de negócio, integrações complexas e automações corporativas inteligentes**. 

Em vez de focar apenas em edição simples de código, o AllCode atua como uma central unificada de orquestração empresarial:
* **Desenvolvimento de Automações Ponta a Ponta:** Criação e manutenção de scripts operacionais, pipelines de ETL, orquestradores de filas e rotinas agendadas corporativas.
* **Construtor Visual de Agentes Especializados (AgentUI):** Criação de agentes inteligentes de atendimento, suporte técnico e operações internas com prompts sob medida e ambiente de testes (*sandbox*).
* **Integração Sistêmica Multicanal:** Conexão nativa com ecossistemas corporativos via servidores MCP (Model Context Protocol), webhooks, APIs REST, robôs de mensageria (Telegram e WhatsApp) e automação de navegadores com visão computacional.
* **App Desktop Corporativo:** Interface gráfica robusta para Windows, macOS e Linux com paridade total em relação ao cliente Web, oferecendo ambiente isolado, seguro e auditável.

---

## 🏢 Arquitetura Corporativa & Diferenciais

### 1. Coexistência Isolada e Segura (Side-by-Side)
Projetado para operar em ambientes empresariais sem conflitos com ferramentas de desenvolvimento já instaladas na estação ou servidor:
* **Porta de rede dedicada:** `1953` (isolada da porta padrão 4096 do upstream).
* **Armazenamento corporativo independente:** banco SQLite dedicado (`allcode.db`), livre de concorrência ou bloqueios.
* **Configuração corporativa por projeto:** pasta `.allcode/` com diretivas claras em `allcode.json` / `allcode.jsonc`.
* **Identidade do sistema operacional:** Protocolo `allcode://` e App ID `ai.allcode.desktop`.

### 2. Motor de Migração Não-Destrutivo (`allcode import`)
Permite importar com segurança históricos e automações prévias:
* O comando `allcode import --opencode` realiza leitura estrita (*read-only*) no banco legado e copia sessões, mensagens e ferramentas para o AllCode com idempotência e integridade referencial.

### 3. Memória Contextual de Negócio Persistente
O AllCode armazena regras de governança, diretrizes operacionais e decisões de sistemas entre sessões:
* **Memória Global (`~/.local/share/allcode/memory/global`):** Padrões de arquitetura corporativa, políticas de segurança e regras da organização.
* **Memória por Projeto (`~/.local/share/allcode/memory/projects/<projeto>`):** Contexto do fluxo de negócio, regras do domínio e modelos de integração específicos da solução.
* Consultada sob demanda (`memory_search`) e atualizada (`memory_save`) pelo raciocínio do agente sem inflar custos com tokens desnecessários.

---

## 🖥️ A Central Desktop do AllCode (Experiência Principal)

A aplicação Desktop do AllCode foi desenhada para concentrar todas as frentes de automação em uma interface fluida e produtiva:

### A. Barra Lateral & Módulos de Operação
* **Code (Engenharia de Soluções):** Desenvolvimento ágil de scripts, microsserviços, conectores de API e regras de negócio com árvore de arquivos, monitor de contexto e controle de versão.
* **AgentUI (Fábrica de Agentes Corporativos):** Criação, edição e teste de agentes autônomos. Permite atribuir papéis, definir ferramentas permitidas e rodar testes de validação em um chat isolado.
* **Rotinas & Agendamentos (Schedule):** Painel para orquestrar rotinas periódicas (CRON), disparadores automáticos de processos e lembretes operacionais com alertas nativos no desktop.
* **Mídia & Métricas:** Dashboard analítico de consumo, auditoria de tokens, custo por provedor/modelo e gestão de arquivos anexos da empresa.

### B. Painéis de Execução e Automação Integrados
* **Terminal PTY Multiplexado:** Shell integrado para rodar containers Docker, scripts em Python/Node/Go e disparar automações de infraestrutura sem sair da conversa com o agente.
* **Navegador Live Integrado (Browser Automation):** Instância interativa do Chromium embutida para desenvolvimento de web scrapers, automação de sistemas legados que não possuem API pública e validação visual de telas.
* **Revisão Visual de Alterações (Diff Review):** Inspeção minuciosa de arquivos modificados em formato *split* ou *inline*, permitindo comentar linhas específicas para solicitar ajustes ao agente.
* **Gestão Ativa de Permissões:** O operador tem controle absoluto: comandos críticos ou destrutivos exigem aprovação explícita no dock de decisões.

### C. Painel de Controle e Governança (Settings v2)
Configurações corporativas completas divididas em:
1. **Desktop:**
   * Aparência (Claro, Escuro ou Sistema), idioma, início automático no boot, execução em background na bandeja (*tray*) e diagnósticos de integridade do banco.
   * Personalização de atalhos de teclado para ganho de agilidade operacional.
2. **Servidores & Conectividade:**
   * Gestão de servidores locais, túneis SSH para máquinas remotas e integração nativa com WSL (Windows Subsystem for Linux).
   * Pareamento de servidores via QR Code para mobilidade e acesso rápido.
   * Catálogo multi-provedor (OpenAI, Anthropic, Google Vertex, DeepSeek, Groq, Ollama, OpenRouter, etc.).
   * **Combos Inteligentes:** Estratégias de failover automático para garantir que as automações nunca parem por indisponibilidade de um provedor de IA.
3. **Customização & Ecossistema:**
   * **Skills Corporativas:** Habilitação de habilidades especializadas da equipe ou de repositórios externos.
   * **MCP (Model Context Protocol):** Conexão direta dos agentes a bancos de dados, servidores de e-mail, CRMs, ERPs e ferramentas corporativas via stdio ou HTTP/SSE.
   * **Mensageria & Notificações:** Integração headless com bots de Telegram e WhatsApp para disparar comandos e receber relatórios de processos em tempo real.
   * **Agentes Externos:** Orquestração de ferramentas CLI e runtimes externos.

---

## 🌐 Paridade Web & Automação Headless 24/7

O AllCode garante **Paridade Absoluta** entre a aplicação Desktop e a interface Web:
* A mesma experiência, atalhos e recursos visuais do desktop estão disponíveis via navegador ao acessar o servidor central do AllCode.

### Rodando em Servidores da Empresa ou VPS
Para manter robôs de automação e rotinas corporativas operando ininterruptamente:
```bash
# Definir chave de autenticação segura
export ALLCODE_SERVER_PASSWORD="sua-senha-corporativa"

# Iniciar servidor completo com interface Web (porta 1953):
allcode web --hostname 0.0.0.0 --port 1953

# Ou iniciar apenas a API do daemon (headless):
allcode serve --hostname 0.0.0.0 --port 1953
```

A partir daí, operadores e analistas podem acessar a interface diretamente via navegador em `http://ip-do-servidor:1953` ou conectar suas instâncias do aplicativo Desktop.

---

## 📦 Instalação

### Aplicativo Desktop (Ambiente Principal)
Baixe o instalador oficial na [Página de Releases](https://github.com/alltomatos/allcode/releases/latest):
* **Windows:** `allcode-desktop-win-x64.exe` (Instalador NSIS corporativo com suporte à bandeja).
* **macOS:** `allcode-desktop-mac-universal.dmg` (Apple Silicon + Intel) / `allcode-desktop-mac-universal.zip`.
* **Linux:** `allcode-desktop-linux-x64.deb` (Debian/Ubuntu), `.rpm` (Red Hat/Fedora) ou `.AppImage`.

### CLI & Servidor via npm
```bash
# Versão estável
npm install -g @alltomatosbr/allcode@latest

# Versão de desenvolvimento contínuo
npm install -g @alltomatosbr/allcode@dev
```

### Interface de Terminal (TUI)
Para operações rápidas no servidor ou terminal local:
```bash
allcode
```

---

## 🔧 Guia de Contribuição e Desenvolvimento

Para clonar e compilar a plataforma no ambiente local:
```bash
git clone -b dev https://github.com/alltomatos/allcode.git
cd allcode
bun install

# Executar a TUI em desenvolvimento
bun dev

# Executar o aplicativo Desktop Electron em modo desenvolvimento
bun dev:desktop

# Executar a validação completa de tipos do monorepo
bun turbo typecheck
```

---

## 👥 Governança & Créditos

O AllCode é idealizado e mantido por **Alltomatos**. O projeto utiliza como base os protocolos e arquitetura de agentes do ecossistema open source **[OpenCode](https://github.com/anomalyco/opencode)** (`anomalyco`), evoluindo-os para atender às demandas corporativas de automação, estabilidade operacional side-by-side, integração de sistemas e interfaces unificadas.
