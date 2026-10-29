# ADD 0007: Tools de Rotinas e Agentes no Chat

## Escopo

O agente do chat passa a operar o ciclo completo de rotinas e a criar agentes no AgentUI sem sair da conversa:

- `routine`: `list`, `get`, `create`, `status`, `restart`.
- `agentui`: `list`, `get`, `create`.

`list` e `get` mantêm o formato legado da tool `routine` para não quebrar chamadas existentes. As novas ações retornam um envelope estável.

## Envelope

```json
{ "ok": true, "data": {} }
```

```json
{
  "ok": false,
  "error": {
    "code": "ROUTINE_NOT_STALLED",
    "message": "ROUTINE_NOT_STALLED: routine sch_... is succeeded",
    "details": { "routineId": "sch_...", "state": "succeeded" }
  }
}
```

Nenhuma stack trace é retornada ao modelo. Causas inesperadas vão para `Effect.logError` e o usuário recebe `ROUTINE_RESTART_FAILED` ou `INVALID_INPUT`.

## Rotinas

### Create

Mapeia `prompt` para uma ação `skill` (`instructions`) ou, quando `agentId` é informado, para uma ação `agentui` (`message`). `tools` vira `mcpTools`, `model` e `workspace` são preservados, e `timeoutMinutes` vira `timeoutMs` na ação (fallback global: 30 minutos).

Idempotência:

- `idempotencyKey` é persistido em `schedule.idempotency_key` (único). Repetir a chamada retorna `{ routineId, status: "existing" }`.
- Sem chave, nome + trigger idênticos retornam `ROUTINE_DUPLICATE` sem criar nada.
- `metadata` é persistido em `schedule.metadata`.

### Status

Estados derivados de `schedule.enabled` + execução mais recente:

- `disabled`: rotina desabilitada.
- `queued`: habilitada e ainda sem execução (ou última execução `skipped`).
- `running`: execução ativa com heartbeat/lease válidos.
- `stalled`: lease expirado, heartbeat ausente (> 45s) ou duração acima do timeout + 60s de tolerância.
- `succeeded` / `failed`: resultado terminal da última execução.

Cada item inclui `attempts`, `lastError`, `lastRun`, `nextRunAt`, `heartbeatAt`, `leaseUntil` e a saúde do scheduler (lease global).

### Restart

Pré-condições:

- rotina precisa existir (`ROUTINE_NOT_FOUND`);
- precisa estar habilitada (`ROUTINE_DISABLED`);
- estado precisa ser `stalled` ou `failed` (`ROUTINE_NOT_STALLED`);
- `confirm: true` é obrigatório (`CONFIRMATION_REQUIRED`);
- limite de 5 tentativas (`ROUTINE_RESTART_LIMIT`);
- cooldown de 10s para falhas recentes (`ROUTINE_RESTART_COOLDOWN`), ignorado para execuções já stalled;
- claim atômico via `schedule_run.lease_until` (`ROUTINE_RESTART_IN_PROGRESS`).

A nova execução é reivindicada antes de cancelar a antiga. Assim, um restart rejeitado não altera o estado anterior. A ação roda em fiber destacada; a tool responde imediatamente com `newState: "running"` e `attempt` incrementado.

O restart é exposto ao `ToolRegistry` por uma bridge registrada pelo grafo do scheduler (`ScheduleRestartBridge`). Isso evita o ciclo `ToolRegistry -> SessionPrompt -> ToolRegistry` que existiria se a tool dependesse diretamente dos callers de skill/AgentUI.

## Agentes

`agentui.create` reutiliza `AgentUIStore` (extraído de `AgentUI.Service`) para persistir no mesmo config global usado pela tela de Settings. Campos:

- obrigatórios: `name`, `systemPrompt`, `model`;
- modelo aceito: `providerID/modelID` ou `combo:<id>`;
- `tools` vira `mcpServers`;
- `permissions` mapeia para `filesystemEnabled`, `terminalEnabled`, `memoryEnabled`, `routinesEnabled`, `agendaEnabled`, `whatsappEnabled`;
- `visibility` (`private`/`public`) e `description` foram adicionados ao schema de agente como campos opcionais;
- a resposta inclui `agentId`, `agentUrl` (`/agentui/<id>/edit`), `group: "Agentes"` e `groupUrl: "/agentui"`.

## Permissões

- `routine` continua sendo a permissão das ações de leitura/criação. `restart` usa a permissão separada `routine_restart` com `always: []`, então exige aprovação explícita a cada reinício mesmo que o usuário já tenha liberado `routine` permanentemente.
- `agentui.create` usa a permissão `agentui` e exige aprovação explícita.
- Sessões de canal do AgentUI negam tudo por padrão. `routinesEnabled` libera `routine` e `routine_restart`; para permitir criação de agentes, adicione uma regra `agentui` allow ao ruleset da sessão.

## Auditoria

Criação, consulta individual de status e restart gravam:

- log estruturado (`routine.create`, `routine.status`, `routine.restart`, `agentui.create`) com `actor`, `sessionID`, `callID`, `routineId`/`agentId` e resultado;
- trilha persistida em `Storage` (`schedule/audit/<routineId>`, `agentui/tool-audit/<agentId>`), limitada aos 50 eventos mais recentes.

## Testes

- `packages/core/test/schedule-health.test.ts`: estados, stall por heartbeat/lease/timeout, próximo disparo.
- `packages/core/test/schedule-runner.test.ts`: restart inexistente/desabilitado/estável, limite, cooldown e recuperação de execução stalled.
- `packages/allcode/test/tool/routine-schema.test.ts`: validação de create, idempotência/duplicidade e validação de agente.
- `packages/allcode/test/tool/routine-tool.test.ts`: fluxo criar -> status -> duplicidade -> restart pela tool.
- `packages/allcode/test/tool/agentui-tool.test.ts`: criar -> listar -> duplicidade -> get de agente pela tool.
- `packages/allcode/test/tool/registry.test.ts`: garante que o grafo de layers continua sem ciclos.

## i18n

A tool do chat não tem camada de i18n no servidor (as tools existentes, incluindo `routine` e `reminder`, já retornam texto fixo). Por isso as mensagens novas seguem o mesmo padrão e usam códigos estáveis; a tradução de UI continua responsabilidade dos dicionários de `packages/app`. Nenhum texto novo de interface foi introduzido por esta mudança.
