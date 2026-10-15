# ADR 0004: Inversão de Controle para Paridade de Plataforma Web e Desktop

## Status
Aceito

## Contexto
O OpenCode possui dois pontos de entrada principais para sua interface gráfica: o executável Desktop baseado em Electron (`packages/desktop`) e o aplicativo Web (`packages/app`) servido por navegadores ou pelo servidor HTTP embutido (`packages/opencode`).

Ao longo dos ciclos de desenvolvimento, a base de código em `packages/app` acumulou condicionais de plataforma imperativas do tipo `if (platform.platform === "desktop")` e chamadas acopladas ao objeto Electron `window.api`. Isso fez com que o modo Web perdesse funcionalidades críticas, ficasse preso a layouts legados ou apresentasse erros de limite de cota de armazenamento (`localStorage`).

## Decisão

1. **Introduzir `PlatformCapabilities`:**
   Desacoplar a lógica da interface das strings `"desktop"` ou `"web"`. Em vez de condicionais de plataforma, os componentes e controladores devem consultar flags booleanas de capacidade ou métodos abstratos disponibilizados no `PlatformProvider`.
   
2. **Implementar `IndexedDB` como Mecanismo Primário de `DraftStore` na Web:**
   Substituir a dependência do `localStorage` síncrono e limitado por uma camada assíncrona baseada em IndexedDB para persistência de rascunhos, imagens e dados volumosos de sessão.

3. **Fallback Elegante para Directory e File Picking na Web:**
   Habilitar `DialogSelectDirectoryV2` para ambientes Web, permitindo navegar nas pastas do servidor conectado através de chamadas HTTP padronizadas à API de Filesystem.

4. **Universalização do V2 Layout:**
   Tornar o V2 Layout (`newLayoutDesigns`) o padrão ativo irrestrito para todas as plataformas, garantindo que o cliente Web receba todos os refinamentos visuais contemporâneos.

## Consequências

### Positivas
- **Paridade Funcional Total:** O usuário no navegador terá a mesma riqueza de experiência e produtividade do Desktop.
- **Arquitetura Limpa:** Componentes de apresentação tornam-se agnósticos ao runtime, facilitando testes unitários e de integração com Happy-DOM/JSDOM.
- **Escalabilidade de Dados:** Fim dos crashes por limite de cota de 5MB no navegador ao anexar arquivos ou rascunhos extensos.

### Mitigações & Riscos
- **APIs Nativas do SO:** Certas ações (ex.: abrir o VS Code local a partir de um servidor remoto) exigirão deep links de protocolo URL (`vscode://`) ou endpoints de orquestração no backend, que devem tratar permissões e CORS adequadamente.
