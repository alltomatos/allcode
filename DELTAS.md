# DELTAS — mudanças intencionais de comportamento

Registro de toda diferença intencional de comportamento em relação ao baseline anterior
a uma mudança no catálogo ou na resolução de modelos. Governa a convergência descrita
no ADR 0008.

## Eixos de comparação

- **Contrato estrito (C1–C5)** compara v1 e v2 **na mesma build**. Divergência ali é
  falha de build, nunca delta.
- **DELTAS** compara a build atual com o **baseline pré-mudança**.

## Quando registrar

Registre uma linha quando a mudança alterar qualquer um destes pontos: qual
provider/modelo existe ou é selecionável (C1), flags e custo por modelo (C2), default
(C3), providers conectados (C4), modelo resolvido de uma especificação (C5), resultado
de execução ou dado persistido.

## Apresentação (presentation-only) — exceção

Mudança classificada como apresentação **não** ganha linha aqui, mas continua exigindo
teste e checklist no PR. É apresentação se, e somente se, **todas** as condições
valerem:

1. nenhum item C1–C5 muda;
2. nenhuma execução muda de resultado (mesmo sucesso/falha, mesmo efeito colateral);
3. nenhum dado persistido muda (configuração, histórico, registros de auditoria).

Se qualquer condição falhar, é delta normal. O que decide a categoria é o efeito
observado, não a intenção declarada. A classificação é reversível: se a revisão
discordar do critério, converte-se em delta normal com linha aqui.

## Regras

- `ID` é estável (`D001`, `D002`, …): nunca renumerado nem reaproveitado.
- A coluna `Teste` traz o nome exato do teste **entre crases**; o meta-teste
  (`packages/allcode/test/meta/deltas.test.ts`) procura esse literal nos arquivos
  `packages/**/*.{test,spec}.{ts,tsx}`.
- Delta sem teste nomeado, ou com nome que não existe em nenhum arquivo de teste,
  reprova o build.
- Cada delta é revertível isoladamente, em commit próprio.
- Remover um delta exige justificativa no PR ou um ADR.

## Deltas

| ID | Delta | Consumidor | Teste | Impacto observável | Reversível por | Fase |
| --- | --- | --- | --- | --- | --- | --- |
| D006 | Default do provider passa a ser o modelo habilitado mais recente (`release_date`), alinhado ao catálogo v2 em vez do `sort()` legado | Chat, AgentUI, Rotinas, TUI | `default do provider é o modelo habilitado mais recente` | O modelo padrão de cada provider pode mudar para o mais recente | commit | F1.5 |
| D001 | Fallback explícito ao modelo padrão quando o modelo configurado está indisponível, com audit `model_fallback`, warning no `diagnose` e aviso na UI | AgentUI, Rotinas com `agentId` | `modelo indisponível cai no padrão e registra origem e destino` | O agente continua respondendo pelo padrão; auditoria e aviso expõem a troca | commit | F1.5 |
| D002 | Combos descartam membros não selecionáveis antes de prioridade/rotação/failover; sem elegíveis → `ComboExhaustedError` | AgentUI, Rotinas, Chat | `descarta membro indisponível e escolhe o próximo elegível` | Um combo pode passar a escolher outro membro ou ficar exaurido antes do envio | commit | F1.5 |
| D005 | Rotina de skill sem `agentId` valida `action.model` antes de criar sessão e falha sem efeito colateral | Rotinas | `modelo indisponível retorna erro específico com modelo e origem` | A rotina falha visivelmente em vez de criar sessão e falhar depois | commit | F1.5 |
| D003 | `opencode-go` sem conexão oculta **todos** os modelos, inclusive `-free`; provider fica só como card de conexão | App, TUI, Chat | `desabilita todos os modelos do opencode-go sem conexão` | Sem conexão, o plano Go não oferece nenhum modelo selecionável | commit | F1.5 |
| D004 | `OPENCODE_DISABLE_FREE_MODELS` esconde os modelos gratuitos de `opencode`/`opencode-*`, com paridade ao upstream | App, TUI, Chat | `OPENCODE_DISABLE_FREE_MODELS desabilita gratuitos` | Operador pode remover gratuitos do catálogo sem alterar código | commit | F1.5 |
| D007 | Cliente prefere a trilha v2 quando o servidor anuncia `providerParity`; preferência explícita (`opencode.providerProtocol`) vence e serve de rollback | App | `prefers V2 when the server announces provider parity` | Com o anúncio ligado, o app passa a consumir `/api/*` | flag + env `OPENCODE_PROVIDER_PARITY` | F3 |
