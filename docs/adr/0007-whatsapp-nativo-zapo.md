# ADR 0007: WhatsApp Nativo no AgentUI via `zapo-js`

- **Status:** Aceito
- **Data:** 2026-10-23
- **Autor:** Equipe de Arquitetura & Engenharia AllCode
- **Relacionado:** `docs/architecture/ADD-whatsapp-native.md`

## Contexto

O AgentUI hoje so conecta WhatsApp por gateways externos (`waconector`: WAHA, Evolution, izapia, etc.), todos baseados em webhook. Isso exige infraestrutura de terceiros, expoe um endpoint publico por canal e impede o pareamento por QR direto no painel.

Existe um fork limpo do `zapo` (`alltomatos/zapo`, publicado como `zapo-js@1.10.0`), uma implementacao TypeScript do protocolo WhatsApp Web multi-device que fala WebSocket/Noise/Signal direto com a Meta e expoe pareamento por QR, eventos tipados e coordenadores de mensagens/grupos.

O requisito e usar essa biblioteca de forma nativa no allcode, com sessao persistida, QR no AgentUI e tools reais para o assistente.

## Decisao

### 1. Dependencia via npm, sem tocar no fork
Adicionar `zapo-js@1.10.0` e `@zapo-js/store-sqlite` como dependencias de `packages/allcode`. Nenhum patch no fork. O fork e espelho limpo do upstream e a versao publicada coincide.

### 2. Um servico dedicado, um cliente por agente
Criar `packages/allcode/src/whatsapp-native/` com `Context.Service` propria. Cada agente com canal `provider: "zapo"` tem um `WaClient` independente, com `sessionId = agentID`, supervisionado por fibra propria. O caminho `waconector` permanece intacto para os demais providers.

### 3. Store SQLite com driver nativo do Bun
Um unico `createStore` no servico, com `createSqliteStore({ path, driver: "auto" })`. Sob Bun o driver resolve para `bun:sqlite`, sem addon nativo. `sessionId` separa credenciais e historico por agente.

### 4. QR e estado por SSE dedicado
O stream global `/event` filtra por `instance.directory`, inadequado para config global de agente. O pareamento usa `GET /whatsapp/native/:agentId/events` (text/event-stream), com snapshot em `GET /whatsapp/native/:agentId`. O QR e renderizado no cliente com a dependencia `qrcode` ja existente.

### 5. Reconexao supervisionada por nos
`WaClient` nao reconecta sozinho. Um `reconcile` a cada 5 s (mesmo padrao do Telegram) inicia sessoes com `autoStart` e um backoff exponencial 2s→60s trata `connection close` sem `isLogout`. Logout limpa credenciais e remove a fibra.

### 6. Tools com permissao explicita
Tool unica `whatsapp` (`send_text`, `send_media`, `status`, `list_chats`, `read_messages`, `react`, `group_*`), gated por `Agent.whatsappEnabled` e pela permissao `whatsapp` em `sessionPermission`. O agente e resolvido via `AgentUI.agentForSession(sessionID)`; sem binding, retorna erro claro.

## Consequencias

### Positivas
- Sem infraestrutura de gateway e sem endpoint publico de webhook para o canal nativo.
- Pareamento e reconexao com UX direta no painel.
- Tools de WhatsApp disponiveis ao assistente com validacao e auditoria.
- `bun:sqlite` evita dependencia nativa e mantem o deploy simples.

### Negativas / Mitigacoes
- Acoplamento a uma biblioteca de protocolo reverso, sujeita a mudancas da Meta.
  - Mitigacao: versao pinada, testes com `@zapo-js/fake-server`, upgrade tratado como M0.
- Sessao em disco sem criptografia em repouso.
  - Mitigacao: diretorio `0700`, arquivo `0600`, QR/credenciais fora dos logs; criptografia em repouso fica como debito.
- Um processo por conta; multi-instancia concorrente sobre o mesmo SQLite nao e suportada na v1.
  - Mitigacao: `sessionId` por agente e documentacao explicita; clustering fica fora de escopo.
- `webhookSecret` deixa de ser obrigatorio no schema.
  - Mitigacao: campo passa a opcional, sem breaking change para configs existentes.
