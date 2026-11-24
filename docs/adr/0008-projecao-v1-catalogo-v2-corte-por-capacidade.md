# ADR 0008: `Provider.Service` v1 como projeção pura do catálogo v2

## Status
Aceito (2026-11-11)

## Contexto

Hoje duas trilhas decidem quais modelos existem e estão disponíveis: o catálogo v2
(Effect-based, `packages/core/src/catalog.ts`) e o `Provider.Service` v1
(`packages/allcode/src/provider/provider.ts`), com regras duplicadas de
disponibilidade, gratuidade, default e filtragem. O app fala v1 porque
`detectServerProtocol` classifica este servidor como v1 ao ver `/global/health`, mas
o catálogo que ele recebe já vem do v2 através do bridge — ou seja, a fonte de
verdade já é o v2, e o v1 reaplica decisões por conta própria.

## Decisão

Transformar o `Provider.Service` v1 em **projeção pura** do catálogo v2 — sem lógica
própria além de transporte (`api.npm`, `api.url`, `api.id`) —, validar equivalência
por módulo consumidor (chat, AgentUI, rotinas) contra um contrato estrito de cinco
projeções (C1–C5) e só então remover a trilha legada. A troca do cliente para v2 não
será uma inversão direta: o servidor anuncia a capacidade de paridade e o app a usa
quando presente, com flag reversível sem release.

## Considered Options

- **Manter as duas trilhas e apenas alinhar comportamentos.** Rejeitado: cada novo
  provider exigiria trabalho duplicado e a divergência voltaria na próxima mudança.
- **Inverter `detectServerProtocol` direto para v2.** Rejeitado como primeiro passo:
  trocaria todas as superfícies do app de uma vez, sem rollback barato, apoiado em
  equivalência provada apenas em laboratório e não em base heterogênea (providers
  custom, combos, configs antigas).

## Consequences

- Duas trilhas coexistem por pelo menos um ciclo, com contrato estrito (C1–C5)
  testado para impedir divergência; divergência ali é falha de build.
- Mudanças de comportamento intencionais são registradas em `DELTAS.md`, com teste
  correspondente; mudanças puramente de apresentação são isentas de linha, mas não
  de teste.
- A remoção do legado depende de inventário explícito de consumidores e não pode se
  apoiar em comportamento exclusivo da trilha antiga.
