# ADR 0006: Resiliência, Coordenação Multi-Instância e Anti-Inchaço no Daemon de Rotinas (`ScheduleRunner`)

- **Status:** Aceito
- **Data:** 2026-10-21
- **Autor:** Equipe de Arquitetura & Engenharia AllCode

## Contexto

O daemon de rotinas (`ScheduleRunner.tickNode` em `packages/core/src/schedule/runner.ts`) é responsável por executar tarefas agendadas (`cron`, `interval`, `once`) no ecossistema AllCode. Na implementação inicial, foram diagnosticados riscos arquiteturais significativos para operação em produção:

1. **Execução Sequencial Bloqueante:** A iteração das rotinas em um loop serial síncrono (`for ... of`) faz com que rotinas lentas de `shell` ou chamadas a LLM (`skill`/`agentui`) bloqueiem indefinidamente o processamento de outras tarefas elegíveis.
2. **Corrida Multi-Processo (Split-Brain / Duplicação):** Processos simultâneos (por exemplo, `allcode serve` e a aplicação Desktop) conectados à mesma base SQLite disparam simultaneamente as mesmas tarefas agendadas.
3. **Ausência de Tolerância a Falhas Transientes:** Falhas pontuais de rede ou timeout em tools/APIs externas resultam em erro imediato sem tentativa rápida de recuperação (*retry*).
4. **Perda de Histórico e Falta de Auditoria:** O estado de execução grava apenas `last_run_at`, `last_status` e `last_error` no registro da própria rotina, sobrescrevendo históricos anteriores sem trilha de auditoria.
5. **Risco de Crash Silencioso:** Falhas não capturadas em nível de fibra do runtime Effect podem desativar o loop de background em segundo plano sem auto-recuperação.

## Decisão

Implementar uma arquitetura de resiliência corporativa no motor de agendamento, composta por cinco pilares inegociáveis:

### 1. Concorrência Segregada por Tipo de Ação
As execuções de rotinas são despachadas em fibras assíncronas concorrentes utilizando semáforos Effect (`Effect.makeSemaphore`) calibrados por tipo de carga:
- **`shell`:** Máximo de **2** execuções simultâneas (evita sobrecarga de CPU/I/O na máquina local).
- **`skill` / `agentui`:** Máximo de **3** execuções simultâneas (evita esgotamento de taxa e cotas de LLM).
- **`reminder` / `mcp_tool`:** Despacho sem retenção (concorrência livre / alta prioridade).

### 2. Coordenação Multi-Instância por Heartbeat no SQLite
Introdução da tabela de controle `daemon_heartbeat`:
- Apenas um processo atua como **Líder Ativo** do agendador.
- O processo líder renova seu *heartbeat* a cada ciclo de verificação do `tick()` (**30 segundos**) (`last_seen = now()`).
- Se o líder parar de responder por **45 segundos**, qualquer outro processo concorrente saudável assume a liderança do agendador atomicamente.
- Processos não-líderes pulam o ciclo de disparo do `tick()`.

### 3. Tolerância a Falhas: 1 Retry Imediato de Cortesia
- Quando uma rotina falhar, o executor realiza automaticamente **1 retentativa imediata de cortesia** para absorver instabilidades de rede passageiras.
- Se a segunda tentativa falhar, o status de erro é registrado e o agendamento permanece intacto, aguardando o próximo ciclo cron/intervalo padrão.

### 4. Tabela de Histórico (`schedule_run`) com Retenção de 7 Dias e Teto de Payload
- Criação da tabela relacional `schedule_run` com campos: `id`, `schedule_id`, `started_at`, `duration_ms`, `status`, `error`, `session_id`.
- **Teto de Payload:** As saídas de erro e logs textuais são sanitizadas e truncadas em no máximo **8 KB**, prevenindo inchaço do SQLite.
- **Auto-Purge Periódico:** Uma rotina interna do daemon expurga, a cada ciclo, registros de execuções com mais de **7 dias** (`started_at < now() - 7d`).

### 5. Supervisão Contínua da Fibra com Auto-Restart
- O loop de tick é envolvido em um **Supervisor Effect com auto-restart**: caso uma exceção inesperada escape, a fibra reinicia automaticamente com recuo de 5 segundos.
- Caso o processo enfrente falha sistêmica prolongada e não consiga renovar o *heartbeat*, ele perde a liderança, permitindo *failover* transparente para outra instância.

## Consequências

### Positivas
- **Execução Confiável e Previsível:** Tarefas demoradas não atrasam lembretes e notificações críticas.
- **Garantia de Execução Única:** Fim de execuções duplicadas ao usar CLI e Desktop simultaneamente.
- **Auditoria Transparente:** Visibilidade das execuções nos últimos 7 dias sem sobrecarregar o banco de dados.
- **Auto-Cura:** O agendador se recupera autonomamente de falhas de processo e defeitos transitórios.

### Negativas / Mitigações
- Necessidade de migração de banco para adicionar `daemon_heartbeat` e `schedule_run`.
- *Mitigação:* As tabelas utilizam schema Drizzle atômico integrado com a inicialização do `Database.node`.
