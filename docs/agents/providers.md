# Providers — Catálogo v2, projeção v1 e resolução de modelos

Contexto estruturado para agentes que trabalham na convergência do catálogo e da
resolução de modelos (ver ADR 0008 e ADR 0009). Cobre chat, AgentUI e rotinas.

## Responsabilidades

1. O catálogo **v2** (`packages/core/src/catalog.ts`, alimentado por
   `packages/core/src/plugin/*`) é a fonte única de existência, `enabled`, custo,
   default e disponibilidade de providers e modelos.
2. O `Provider.Service` **v1** (`packages/allcode/src/provider/provider.ts`) projeta
   o catálogo para o contrato público existente. Não decide nada além de transporte.
3. A resolução de modelo por string (`providerID/modelID`, `combo:<id>`,
   `combo/<id>`) atende chat, AgentUI e rotinas com semântica estável.
4. A disponibilidade de um provider depende de conexão/credencial no escopo de
   localização atual.
5. A troca de trilha do cliente (v1 → v2) é feita por capacidade anunciada pelo
   servidor, não por inversão direta.

## Contrato estrito (C1–C5)

Projeções que os consumidores leem e que devem ser idênticas entre v1 e v2 na mesma
build. Divergência aqui é **falha**, não delta.

| # | Projeção | Campos |
|---|---|---|
| C1 | Conjunto de modelos | pares `(providerID, modelID)` selecionáveis |
| C2 | Flags por modelo | `enabled`, `status`, `cost.*`, `limit.*`, `capabilities.tools`, `capabilities.input/output` |
| C3 | Default | default por provider e default global |
| C4 | Providers conectados | conjunto de IDs disponíveis no escopo |
| C5 | Modelo resolvido | par concreto para uma especificação persistida |

**Normalização da comparação:** ordenar chaves e arrays, arredondar custo para 6
casas, tratar ausência de `cost` como zero, `release_date` em `YYYY-MM-DD`.

**Fora do contrato estrito:** `api.npm`, `api.url`, `api.settings` — o v1 sintetiza
`@ai-sdk/openai-compatible` onde o v2 declara `native`/`aisdk`. `api.id` (modelo
upstream real) **está** no contrato, porque é o que a chamada envia.

## Superfícies consumidoras

- **AgentUI** — `packages/allcode/src/agentui/index.ts`: `resolveModel` (:430-450),
  dispatch (:562-565, :628-635), capabilities (:573-581), `diagnose` (:782-863).
- **Rotinas** — `agentId` → `packages/allcode/src/schedule/agentui-caller.ts`;
  skill → `packages/allcode/src/schedule/skill-caller.ts:78-107`;
  validação em `packages/allcode/src/tool/routine-schema.ts:155-158`.
- **Combos** — `packages/allcode/src/combo/index.ts:199-219` (`Combo.resolve`) e
  `packages/core/src/session/runner/model.ts:196-230` (`resolveComboModel`).
- **Chat** — `packages/allcode/src/provider/provider.ts:2106-2220`.
- **App** — `packages/app/src/context/global-sync/bootstrap.ts:236-246`,
  `packages/app/src/utils/server-protocol.ts:24-37`.
- **TUI** — `packages/tui/src/context/sync.tsx:458-508` (model picker usa a trilha v1).

## Fases e gates

| Fase | Conteúdo | Gate |
|---|---|---|
| F1 | Projeção neutra, `core` congelado, `DELTAS.md` vazio | C1–C5 verde; revert = 1 commit |
| F1.5 | D001–D004, um commit por delta | cada delta com linha em `DELTAS.md` e teste nomeado |
| F2 | Validação de AgentUI, rotinas e app | matriz de testes por superfície |
| F3 | Corte por capacidade e remoção do legado | e2e nas duas trilhas + lista de consumidores |

Na F1, `fromCatalog` só pode derivar `api.npm`, `api.url` e `api.id`. Campo novo ali
é sinal de catálogo incompleto: pare, registre como candidato a delta da F1.5.

## Deltas (F1.5)

| ID | Delta | Consumidor |
|---|---|---|
| D001 | Fallback explícito ao default global em AgentUI e rotina `agentId`, com audit `model_fallback`, warning no `diagnose` e aviso na UI | AgentUI, Rotinas |
| D002 | Combo descarta membros não selecionáveis nos dois resolvedores; sem elegíveis → `ComboExhaustedError` | AgentUI, Rotinas, Chat |
| D003 | `opencode-go` sem conexão oculta **todos** os modelos (pagos e `-free`) | App, TUI, Chat |
| D004 | `OPENCODE_DISABLE_FREE_MODELS` oculta modelos gratuitos | App, TUI, Chat |

**Apresentação (sem delta):** mensagem/destaque de falha da rotina de skill; entrada
“indisponível” no seletor; anúncio de capacidade. Critério: C1–C5 intactos, resultado
de execução idêntico e nenhum dado persistido alterado.

## Edge cases decididos

- **Modelo indisponível em AgentUI / rotina `agentId`:** fallback em runtime para o
  default, com auditoria e aviso. A config persistida não é reescrita e o aviso
  desaparece quando ela é corrigida.
- **Rotina de skill sem `agentId` com `action.model` indisponível:** falha antes de
  qualquer efeito colateral, sem chamada ao provider, com mensagem específica.
- **Combo com membro indisponível:** o membro é descartado na resolução; se todos
  forem descartados, `ComboExhaustedError`.
- **Valor persistido ausente da lista:** seletor exibe entrada não selecionável
  “indisponível”.
- **`opencode-go` sem conexão:** provider aparece apenas como tile “conectar”.
- **`opencode-go` conectado:** o catálogo é intersectado com `GET /zen/go/v1/models`
  (cache em memória de 5 min, fail-open). Modelos ausentes ou depreciados na API
  ficam `enabled=false`; falha de rede mantém o último catálogo conhecido.
- **`OPENCODE_DISABLE_FREE_MODELS=1`:** gratuitos saem do catálogo e os consumidores
  caem nos caminhos acima.

## Critério de sucesso por fase

- **F1:** harness C1–C5 verde para os cenários sem chave, com chave `opencode`,
  `opencode-go` conectado, provider custom e combos.
- **F1.5:** um teste nomeado por delta; teste meta falha se algum `ID` de
  `DELTAS.md` não tiver teste.
- **F2:** AgentUI resolve `combo:`, `combo/<id>` e `provider/model` exatamente como
  antes; rotina `agentId` delega; rotina de skill mantém `providerID:"combo"`;
  app recebe v1 e v2 com o mesmo C1–C5.
- **F3:** e2e completo nas duas trilhas no mesmo build; flag reverte para v1 sem
  release.

## Fora de escopo (fatias irmãs)

Selo “Free” em TUI/CLI; branding “AllCode Go” vs “OpenCode Go”; unificação dos dois
resolvedores de combo; detecção de free na telemetria de stats.
