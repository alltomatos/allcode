# CLAUDE.md

## Módulo: Providers — catálogo v2 como fonte única, v1 como projeção

**Responsabilidade**: decidir quais providers/modelos existem, quais estão disponíveis e qual par `providerID/modelID` chat, AgentUI e rotinas usam.

**Invariantes**:
- O catálogo **v2** (`packages/core/src/catalog.ts`, alimentado por `packages/core/src/plugin/*`) é a **única fonte de verdade** de existência, `enabled`, custo, default e disponibilidade. Toda regra vive lá; nunca no bridge.
- O `Provider.Service` **v1** (`packages/allcode/src/provider/provider.ts`) é **projeção pura** do catálogo. `fromCatalog` só pode derivar transporte: `api.npm`, `api.url`, `api.id`. Proibido decidir disponibilidade, gratuidade, default ou filtragem no bridge.
- O runtime de chat ainda executa pela trilha v1 (`resolveSDK`/`getLanguage`). Migrar para o runner v2 é um corte separado, controlado por **capacidade anunciada** pelo servidor e reversível por flag. `detectServerProtocol` classifica este servidor como v1 por responder `/global/health`.
- `fromCatalog` **preserva** `provider.request.headers` em `options.headers` (necessário para headers de gateway, ex. `x-opencode-org-id`). Credencial OAuth e `fetch` de protocolos proprietários continuam injetados em `syncCatalogModel`, porque o catálogo não conhece o wire protocol.
- Disponibilidade de provider vem de conexão/credencial no escopo de localização. A heurística **licença ≈ conexão** para `opencode-go` (ADR 0009) fica num único ponto do core e não deve ser duplicada.
- AgentUI e rotinas resolvem modelo por string persistida (`agent.model`, `schedule.action.model`). Fallback para o default ocorre apenas em AgentUI e em rotina com `agentId`; rotina de skill sem `agentId` falha antes de qualquer efeito colateral. A configuração persistida nunca é reescrita automaticamente.

**O que NÃO fazer**:
- Não adicionar lógica de disponibilidade, free ou default em `packages/allcode/src/provider/provider.ts` — precisar de campo novo ali é sinal de catálogo incompleto.
- Não assumir que editar `packages/core/src/plugin/provider/*.ts` resolve bug de chat: confirme antes qual runtime está ativo.
- Não colocar override de `fetch`/`apiKey` no loader `custom()` antigo de `provider.ts`: ele só roda se `database[providerID]` já existir (models.dev/config) e é pulado em silêncio para providers registrados só por plugin v2. Caso real: `antigravity-adapter.ts`.
- Não confiar em "aparece no seletor" como prova de que o adapter de inferência funciona — catálogo e chamada real são caminhos separados.
- Não reescrever `agent.model`/`action.model` para "corrigir" modelo indisponível; sinalize e faça fallback em runtime.

**Depuração de "provider conectado mas chat falha"**: a mensagem não viaja por request HTTP visível por chamada — o app abre uma conexão SSE única na inicialização, `prompt_async` apenas dispara (204, fire-and-forget) e o resultado real (incluindo `session.error`) chega como evento nessa stream. No DevTools do Electron: Network → Preserve log → recarregue → filtre `event` → aba **EventStream** → filtre `error`.

## Iniciativa: Tech Debt — divisão de arquivos grandes (`packages/app/src`)

**Responsabilidade**: reduzir arquivos monolíticos de `packages/app/src` em módulos menores por responsabilidade, sem alterar comportamento.

**Rastreamento**: issues rotuladas `tech-debt` no repositório histórico `alltomatos/opencode` (#13, #14, #15, #16, #17, #18, #19); o tracker atual é `alltomatos/allcode`. Trabalho sequencial, uma issue por vez/PR.

**Invariantes**:
- `pages/layout.tsx` (#13) e `context/layout.tsx` (#18) NÃO devem ser divididos antes do épico #25 (descontinuação do layout legado / `newLayoutDesigns()`) avançar — dividir agora é trabalho descartável, pois o épico planeja deletar/reescrever esses arquivos por completo. Priorizar as fatias independentes do épico #25 primeiro: #19, #17, #16, #15, #14.
- Cada issue vira slices pequenos (idealmente um PR por issue, commits menores dentro dela), verificados manualmente no preview antes de prosseguir — nunca um PR monolítico misturando múltiplas issues de split.
- Divisão de arquivo é refatoração pura: nenhuma mudança de comportamento/UX deve acompanhar o split. Se um bug for encontrado durante o split, abrir issue separada — não corrigir dentro do PR de refactor.
- Após cada split, `/qa-analyst` deve confrontar app antes/depois (sem regressão visual/funcional) antes de abrir PR.

**O que NÃO fazer**:
- Não iniciar #13 ou #18 sem antes checar o status do épico #25.
- Não abrir uma única issue/PR cobrindo dois arquivos grandes ao mesmo tempo — mantém rastreabilidade 1:1 com a issue do GitHub.
