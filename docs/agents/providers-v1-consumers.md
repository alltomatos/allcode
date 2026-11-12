# Consumidores da trilha v1 de providers

Inventário exigido pela #38 antes de qualquer remoção (ADR 0008). Classificação:
**migra** (pode passar a consumir v2), **preserva** (não depende do catálogo) e
**exclusivo** (depende de comportamento que só existe no v1 hoje).

## Núcleo

| Artefato | Local | Classificação |
| --- | --- | --- |
| `Provider.Service` (estado, hidratação, resolução de SDK) | `packages/allcode/src/provider/provider.ts` | **exclusivo** — é a trilha em si |
| `fromModelsDevProvider` | `provider.ts:1513-1538` | **exclusivo** — base estática da lista v1 |
| `defaultModelIDs` | `provider.ts:1294-1311` | **migra** — já espelha o catálogo (D006) |
| Loaders `custom()` | `provider.ts` (mapa por `providerID`) | **exclusivo** — injeção de `fetch`/`apiKey` por provider |
| Loader `opencode` (apaga pagos sem chave) | `provider.ts:302-324` | **exclusivo** — equivalente ao auto-disable do core, mas no v1 |
| `syncCatalogModel` | `provider.ts:2129-2180` | **exclusivo** — bridge de credencial/wire protocol |
| `fromCatalog` (projeção) | `provider.ts:1549-1608` | **migra** — passa a ser o único ponto de leitura do catálogo |

## Endpoints

| Rota | Handler | Classificação |
| --- | --- | --- |
| `GET /provider` | `handlers/provider.ts:122-...` via `ProviderView.projectProviderView` | **migra** — lógica de merge já extraída e testada |
| `GET /config/providers` | `handlers/config.ts:24-30` | **migra** — hoje v1 puro; consumido pelo TUI |
| `GET /provider/auth` | `handlers/provider.ts` | **preserva** — fluxo de credencial continua necessário |
| `GET /api/provider`, `/api/model`, `/api/default` | `packages/server/src/handlers/{provider,model}.ts` | **preserva** — destino do corte |

## Clientes

| Cliente | Local | Classificação |
| --- | --- | --- |
| App — detecção de trilha | `packages/app/src/utils/server-protocol.ts` | **migra** — já suporta anúncio de capacidade e preferência |
| App — bootstrap v1 | `packages/app/src/context/global-sync/bootstrap.ts:236-239` | **migra** — branch v1 a remover após o corte |
| App — normalizer v1 | `packages/app/src/context/global-sync/utils.ts:58-73` | **migra** — só usado no branch v1 |
| App — seleção de modelo | `packages/app/src/context/models.tsx`, `hooks/use-providers.ts` | **migra** — consome o shape normalizado |
| TUI — seletor de modelo | `packages/tui/src/component/dialog-model.tsx` (usa `/provider` filtrado por `connected`) | **migrado** (commit 6b0e4bc7e) |
| TUI — conexão de provider | `packages/tui/src/component/dialog-provider.tsx:118` (`/provider`) | **migra** |
| CLI `run` — footer | `packages/allcode/src/cli/cmd/run/runtime.boot.ts` (usa `/provider` com fallback) | **migrado** (commit e73477351) |
| SDK legado `packages/sdk/js` | gerado de `HttpApi` v1 | **verificar** — regenerar antes do corte |
| App mobile (`D:\dev\opencode_mobile`, repo externo) | consome `/provider` e `/config/providers` | **verificar** — não está neste repositório |
| Painel (`packages/panel`) | `default_provider`/`default_model` como texto | **preserva** — não lê catálogo |

## Dependências exclusivas que bloqueiam a remoção

1. **Injeção de `fetch` por provider** (`syncCatalogModel`) para protocolos proprietários
   (AGY, Kiro). O catálogo não conhece o wire protocol; remover o bridge sem mover
   essa injeção para o runner v2 quebra esses providers.
2. **Loader `custom()`** — usado por providers que não passam pelo catálogo v2.
3. **`/config/providers` no TUI** — enquanto o seletor do TUI ler essa rota, ela não
   pode desaparecer.
4. **SDK legado e app mobile** — qualquer mudança de shape de `/provider` precisa
   ser verificada fora deste repositório.

## Ordem de corte proposta (para a #39)

1. Migrar TUI e CLI para o endpoint v2 (ou para `/provider` já projetado).
2. Verificar SDK legado e mobile; manter `/provider` como alias se houver consumidor.
3. Mover a injeção de `fetch` proprietária para o caminho v2.
4. Só então remover `fromModelsDevProvider`, `custom()` e o branch v1 do app.

Nada aqui autoriza remoção: a #39 continua bloqueada por um ciclo de paridade em
produção com `OPENCODE_PROVIDER_PARITY=1`.

