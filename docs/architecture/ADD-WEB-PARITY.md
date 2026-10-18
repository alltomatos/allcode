# ADD 0005: Paridade de Plataforma Web com OpenCode Desktop

## 1. Visão Geral & Contexto de Negócio

O ecossistema OpenCode evoluiu significativamente no cliente Desktop (`packages/desktop`), trazendo recursos visuais modernos (V2 Layout), ferramentas integradas de inspeção (Browser Panel), seleção nativa de arquivos/pastas, rotinas agendadas e integração profunda com servidores locais e remotos. No entanto, o cliente Web (`packages/app` servido via navegador ou embutido no binário do servidor) sofreu defasagem progressiva devido ao acoplamento a APIs do Electron (`window.api`) e verificações explícitas de `platform.platform === "desktop"`.

### 1.1 Objetivo
Garantir que a versão **Web** do OpenCode possua **100% de paridade funcional e visual** com a experiência do Desktop, operando tanto em modo local autohospedado (`opencode serve`) quanto em deployment web corporativo/SaaS, sem regressões no Desktop e seguindo estritamente a Clean Architecture, Inversão de Controle e segurança OWASP.

---

## 2. Decisões Arquiteturais Principais (Resumo)

### Decisão 1: Inversão de Controle com `PlatformCapabilities` (Fim do `if (desktop)`)
- **Problema:** A UI tomava decisões de layout e habilitava recursos com base na string fixa da plataforma (`platform.platform === "desktop"`).
- **Solução:** A interface `Platform` passa a expor capacidades declarativas (`PlatformCapabilities`):
  - `canPickDirectory`: se suporta seleção de pasta (nativa via Electron ou virtual via Server File API).
  - `canOpenInEditor`: se suporta abrir arquivos no editor local (via deep link `vscode://` ou endpoint do server).
  - `hasEmbeddedBrowser`: se tem suporte a browser embutido (WebContents no desktop, sandbox iframe na web).
  - `hasPersistentStorage`: se suporta armazenamento ilimitado de alta capacidade (IndexedDB na web, SQLite/file no desktop).

### Decisão 2: Persistência Web Resiliente com IndexedDB (`DraftStore` e Estados)
- **Problema:** Na Web, o app recorria a `localStorage` (limite estrito de 5MB), gerando `QuotaExceededError` ao salvar múltiplos prompts longos, imagens em base64 e snapshots de sessões.
- **Solução:** Implementação de `createIndexedDbDraftStore()` com fallback transparente, garantindo persistência robusta assíncrona para rascunhos, imagens e cache local.

### Decisão 3: File & Directory Navigation na Web
- **Problema:** Usuários web não podiam abrir projetos navegando em diretórios locais de maneira ergonômica quando conectados a servidores remotos ou locais.
- **Solução:** Na Web, o `useDirectoryPicker` delega para o `DialogSelectDirectoryV2` integrado à API de FileSystem do servidor (`@allcode/server`), oferecendo experiência idêntica ao picker nativo.

### Decisão 4: Browser Panel Universal (Sandboxed Iframe & Proxy)
- **Problema:** O `BrowserPanel` dependia exclusivamente de chamadas `window.api.browserPanel.*` do Electron.
- **Solução:** Implementação de um adaptador web para o `BrowserPanel` que utiliza `iframe` sandboxed com proxy reverso do servidor local para contornar headers restritivos (`X-Frame-Options` / CSP) em desenvolvimento, ou fallback para navegação em popout/aba com sincronização.

---

## 3. Diagrama C4 & Fluxo de Arquitetura

### 3.1 C4 - Contêineres & Inversão de Plataforma

```mermaid
C4Container
    title Arquitetura de Plataforma Unificada (OpenCode)

    Container(app_ui, "packages/app (SolidJS UI)", "SolidJS, Tailwind, Theme, i18n", "Camada de apresentação, layouts V2, componentes de sessão e chat")
    
    ContainerDb(idb, "IndexedDB (Navegador)", "Browser Storage", "Armazenamento ilimitado de drafts, anexos e chaves")
    ContainerDb(electron_store, "Electron Store / File", "Desktop OS", "Armazenamento em disco nativo do desktop")

    Container_Boundary(plat, "Camada de Abstração de Plataforma")
        Component(plat_adapter_web, "WebPlatformAdapter", "TypeScript", "Implementa PlatformCapabilities para Browser / HTTP Server")
        Component(plat_adapter_desktop, "DesktopPlatformAdapter", "TypeScript / Electron IPC", "Implementa PlatformCapabilities via window.api")
    Boundary_End()

    Container(server, "opencode server (Backend)", "Bun / Effect", "API HTTP, SSE, V2 Session Runner, Filesystem & PTY")

    Rel(app_ui, plat_adapter_web, "Consome contrato unificado Platform")
    Rel(app_ui, plat_adapter_desktop, "Consome contrato unificado Platform")
    Rel(plat_adapter_web, idb, "Grava rascunhos e cache")
    Rel(plat_adapter_desktop, electron_store, "Grava rascunhos e cache")
    Rel(plat_adapter_web, server, "Operações de FS, PTY e execução de comandos")
    Rel(plat_adapter_desktop, server, "Conexão HTTP/WebSocket")
```

---

## 4. Matriz de Paridade Funcional

| Funcionalidade | Implementação Desktop | Nova Implementação Web |
|---|---|---|
| **V2 Layout (New Layout)** | Ativado por padrão | Habilitado integralmente na Web por padrão |
| **Directory Picker** | `window.api.openDirectoryPicker` | `DialogSelectDirectoryV2` via API HTTP do Server |
| **File Picker & Attachments** | `window.api.openFilePicker` | `<input type="file">` HTML5 + drag & drop |
| **Abrir no Editor (VS Code)** | `window.api.openPath(path, app)` | Deep links `vscode://file/...` / Rota Server |
| **Browser Panel** | Electron WebContents IPC | Sandboxed `iframe` / Popout window com proxy |
| **Drafts & Armazenamento** | Electron IPC (`draftBlobPut`) | `IndexedDB` assíncrono para drafts e blobs |
| **Notificações** | Electron Notification | Web Notification API com fallback sonoro |
| **Terminal & PTY** | WebSocket + Ghostty Web | WebSocket + Ghostty Web (idêntico) |
| **Titlebar & Janela** | Custom window chrome (Traffic lights) | Titlebar web sem botões de fechar/minimizar SO |

---

## 5. Especificações Técnicas de Código

### 5.1 Enriquecimento do Contrato `Platform` (`packages/app/src/context/platform.tsx`)

```ts
export type PlatformCapabilities = {
  readonly canPickDirectoryNative: boolean
  readonly canOpenInLocalEditor: boolean
  readonly hasEmbeddedBrowser: boolean
  readonly hasWindowControls: boolean
  readonly supportsCustomThemes: boolean
}

export type Platform = PlatformBase & {
  capabilities: PlatformCapabilities
} & (
  | { platform: "web"; os?: never }
  | {
      platform: "desktop"
      os?: DesktopOS
      openDirectoryPickerDialog(opts?: OpenDirectoryPickerOptions): Promise<PickerPaths>
    }
)
```

### 5.2 Storage IndexedDB (`packages/app/src/utils/draft-store-idb.ts`)

```ts
import type { DraftStore } from "./draft-store"

export function createIndexedDbDraftStore(): DraftStore {
  const DB_NAME = "opencode_drafts_v1"
  const STORE_DRAFTS = "drafts"
  const STORE_BLOBS = "blobs"

  // Implementação assíncrona utilizando IndexedDB nativo
  // com suporte completo a gravação e recuperação de ArrayBuffer / Blobs
  return {
    get: async (key: string) => { /* IDB Get */ },
    set: async (key: string, value: string) => { /* IDB Put */ },
    remove: async (key: string) => { /* IDB Delete */ },
    putBlob: async (blob: Blob) => { /* IDB Put Blob */ },
    getBlob: async (id: string) => { /* IDB Get Blob */ },
  }
}
```

---

## 6. Governança, Segurança OWASP & Resiliência

1. **Sanitização de Caminhos e Deep Links:** Qualquer URL gerada para abrir em editores externos (`vscode://`, `cursor://`) deve validar e sanitizar caminhos absolutos para impedir injeção de parâmetros arbitrários.
2. **CSP (Content Security Policy) no Servidor:** O servidor Bun já injeta CSP em `packages/opencode/src/server/shared/ui.ts`. As rotas de UI servidas na web manterão hashes rígidos para scripts e estilos.
3. **Isolamento de Sessão:** O armazenamento no IndexedDB deve ser isolado por origem/domínio, respeitando o modelo multitenancy caso o servidor sirva múltiplos usuários com autenticação de token.
