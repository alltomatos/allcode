# Análise de Arquitetura de Dados: Panel (Cloudflare D1) → Alternativa Auto-Escalável

## 1. Arquitetura Atual do Panel

### 1.1 Configuração Cloudflare (wrangler.jsonc)
```jsonc
{
  "name": "allcode-panel",
  "d1_databases": [
    { "binding": "DB", "database_name": "allcode-panel", "database_id": "da2843cf-...", "migrations_dir": "migrations" }
  ],
  "r2_buckets": [{ "binding": "ASSETS_BUCKET", "bucket_name": "allcode-panel-assets" }],
  "compatibility_date": "2025-10-01",
  "compatibility_flags": ["nodejs_compat"]
}
```

### 1.2 Esquema de Dados (13 migrations)

| Tabela | Propósito | Índices | Volume Esperado |
|--------|-----------|---------|-----------------|
| `organization` | Tenants (empresas) | PK `id`, UNIQUE `slug`, idx `reseller_id` | ~100-10.000 |
| `panel_user` | Colaboradores | PK `id`, UNIQUE `email`, idx `org_id,status` | ~300-1.000.000 |
| `audit_event` | Auditoria admin (login, CRUD) | PK `id`, idx `at DESC`, idx `target_id,at DESC` | **Alto** |
| `session_audit` | Telemetria sessões Desktop | PK `id`, idx `user_id,started_at`, idx `org_id,started_at` | **Muito Alto** |
| `provider_definition` | Catálogo provedores por tenant | PK `id`, UNIQUE `org_id,provider_id` | Baixo |
| `provider_grant` | Permissões sparse (grupo/usuário) | PK `(scope,scope_id,provider_id)` | Médio |
| `user_provider_credential` | Credenciais individuais | PK `(user_id,provider_id)` | Baixo |
| `access_group` / `access_group_member` | RBAC | PK, idx `org_id`, idx `user_id` | Médio |
| `plan` / `reseller` | Comercial | PK, idx | Baixo |

### 1.3 Padrões de Escrita (Write Patterns)

```typescript
// 1. Session Audit - UPSERT por session_id (Desktop envia updates incrementais)
await db.sessions.create({
  sessionID, userID, orgID,  // ← sessionID é a chave de idempotência
  tokensTotal, tokensInput, tokensOutput, tokensReasoning,
  costUsd, durationMs, messagesCount,
  modelUsage: [{ providerID, modelID, tokens, costUsd, calls }]
})

// 2. Audit Event - INSERT append-only (toda ação admin)
await db.audit.log({ actorEmail, action, result, targetType, targetID })

// 3. Admin CRUD - UPDATE/INSERT em panel_user, organization, provider_definition, etc.
```

**Frequência estimada (1000 users ativos):**
- `session_audit`: ~50-200 writes/seg (pico horário comercial) — cada sessão gera múltiplos upserts
- `audit_event`: ~10-50 writes/seg (ações admin)
- `panel_user` / `organization`: < 1 write/seg

### 1.4 Padrões de Leitura (Read Patterns)

```typescript
// Dashboard auditoria: paginação + busca full-text em title/summary/workspace
db.sessions.listByOrg(orgID, { userID, search, limit: 20, offset })

// KPIs agregados: full table scan por org_id
db.sessions.getOrgKPIs(orgID)  // SUM(tokens), SUM(cost), COUNT(*)

// Model usage analytics: filtro por janela de tempo + GROUP BY provider:model
db.sessions.getUserModelUsage(userID, { days: 30 })

// Auditoria admin: list + filter por target_id
db.audit.list(orgID, 50)
db.audit.forTarget(targetID, 20)
```

### 1.5 Store Implementation (src/lib/store.ts)

Duas implementações da interface `Store`:
- **`memoryStore()`** — desenvolvimento/testes (Maps em memória)
- **`d1Store(db: D1Database)`** — produção (SQL parametrizado via `db.prepare().bind().run()`)

Todas as queries usam **índices compostos por `org_id` + timestamp** para isolamento multi-tenant.

---

## 2. Limitações do Cloudflare D1 para Este Workload

| Limitação | Valor D1 | Impacto no Panel |
|-----------|----------|------------------|
| **Escrita concorrente** | Single-writer (1 tx por vez) | Contenção severa em `session_audit` upserts |
| **Throughput escrita** | ~100K rows/seg (ideal), ~10-20K real | 50-200 writes/seg pico = saturação |
| **Tamanho por DB** | 10 GB | `session_audit` com JSON `model_usage` cresce rápido |
| **Conexões simultâneas** | Limitado pelo Workers runtime | Sem pool de conexões; timeouts em bursts |
| **Horizontal scaling** | **Zero** (1 DB = 1 instância) | Não dá para shardar nativamente |
| **Full-text search** | Não nativo | Busca `LIKE` em `session_audit` é lenta |
| **Analytics/OLAP** | Não suportado | KPIs exigem full scan; sem columnar |
| **Particionamento** | Manual via `ATTACH` | Complexo de operar |
| **Backup point-in-time** | Não | Risco de perda de auditoria |

### 2.1 Cenário de Falha Projetado (1000 colaboradores)

```
Horário comercial (9h-18h):
├── 1000 users × 3 sessões/dia × 15 upserts/sessão = 45.000 upserts/hora
├── = ~12,5 writes/seg base + picos de 5-10x = 60-125 writes/seg
├── Cada upsert = SELECT (índice) + UPDATE/INSERT + JSON parse/serialize
├── D1 single writer serializa tudo → latência p99 > 5s, timeouts Workers
└── Dashboard KPIs (SUM/COUNT) travam o writer → experiência degradada
```

---

## 3. Alternativa Recomendada: **D1 (Config) + Hyperdrive → PostgreSQL (Auditoria/Analytics)**

### 3.1 Arquitetura Híbrida

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers (Panel API)              │
├──────────────────────┬──────────────────────────────────────────┤
│  D1 Database         │  Hyperdrive Connection                   │
│  (allcode-panel)     │  → Neon / Supabase / Railway PostgreSQL  │
├──────────────────────┼──────────────────────────────────────────┤
│  • organization      │  • session_audit (particionado por mês)  │
│  • panel_user        │  • audit_event (particionado por mês)    │
│  • provider_*        │  • model_usage_agg (materialized view)   │
│  • access_group      │  • kpi_daily (rollup diário)             │
│  • plan / reseller   │  • full-text search (pg_trgm / paradedb) │
│  • user_provider_cred│                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

### 3.2 Por que Neon PostgreSQL (Serverless)

| Critério | Neon | Supabase | Railway | RDS Aurora |
|----------|------|----------|---------|------------|
| **Scale-to-zero** | ✅ (cold start ~1s) | ❌ (sempre ativo) | ✅ | ❌ |
| **Branch/Preview** | ✅ (git-like) | ❌ | ❌ | ❌ |
| **Particionamento nativo** | ✅ | ✅ | ✅ | ✅ |
| **Hyperdrive compatível** | ✅ | ✅ | ✅ | ✅ |
| **Custo base (dev)** | $0 (free tier) | $25/mês | $5/mês | ~$50/mês |
| **Custo prod (1000 users)** | ~$20-40/mês | ~$60-100/mês | ~$30-50/mês | ~$100+/mês |
| **PgBouncer integrado** | ✅ | ✅ | ✅ | ✅ |
| **Point-in-time recovery** | ✅ (7 dias free) | ✅ | ✅ | ✅ |

### 3.3 Esquema PostgreSQL Otimizado

```sql
-- 1. session_audit particionado por mês (time-series)
CREATE TABLE session_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    org_id UUID NOT NULL,
    title TEXT,
    summary TEXT NOT NULL,
    workspace TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    tokens_total BIGINT DEFAULT 0,
    tokens_input BIGINT DEFAULT 0,
    tokens_output BIGINT DEFAULT 0,
    tokens_reasoning BIGINT DEFAULT 0,
    cost_usd NUMERIC(12,6) DEFAULT 0,
    duration_ms BIGINT DEFAULT 0,
    messages_count INT DEFAULT 0,
    model_usage JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (started_at);

-- Partição por mês (auto-criada via pg_partman ou script)
CREATE TABLE session_audit_2026_01 PARTITION OF session_audit
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE session_audit_2026_02 PARTITION OF session_audit
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ...

-- Índices por partição (automáticos)
CREATE INDEX ON session_audit (org_id, started_at DESC);
CREATE INDEX ON session_audit (user_id, started_at DESC);
CREATE INDEX ON session_audit (session_id) WHERE ended_at IS NOT NULL;
-- Full-text search com pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON session_audit USING GIN (title gin_trgm_ops, summary gin_trgm_ops, workspace gin_trgm_ops);

-- 2. audit_event particionado por mês
CREATE TABLE audit_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    actor_id UUID,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    result TEXT NOT NULL CHECK (result IN ('allow','deny')),
    at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (at);

-- 3. Materialized view para KPIs diários (refresh a cada 5 min)
CREATE MATERIALIZED VIEW kpi_daily AS
SELECT
    org_id,
    date_trunc('day', started_at)::date AS day,
    COUNT(*) AS sessions,
    SUM(tokens_total) AS total_tokens,
    SUM(cost_usd) AS total_cost_usd,
    SUM(duration_ms) AS total_duration_ms,
    COUNT(DISTINCT user_id) AS active_users
FROM session_audit
GROUP BY org_id, date_trunc('day', started_at);

CREATE UNIQUE INDEX ON kpi_daily (org_id, day);

-- 4. Model usage rollup (refresh a cada hora)
CREATE MATERIALIZED VIEW model_usage_daily AS
SELECT
    org_id,
    date_trunc('day', started_at)::date AS day,
    mu->>'providerID' AS provider_id,
    mu->>'modelID' AS model_id,
    SUM((mu->>'tokens')::bigint) AS tokens,
    SUM((mu->>'costUsd')::numeric) AS cost_usd,
    SUM((mu->>'calls')::int) AS calls,
    COUNT(DISTINCT session_id) AS sessions
FROM session_audit,
LATERAL jsonb_array_elements(model_usage) AS mu
GROUP BY org_id, date_trunc('day', started_at), provider_id, model_id;

CREATE UNIQUE INDEX ON model_usage_daily (org_id, day, provider_id, model_id);
```

---

## 4. Plano de Migração (Zero-Downtime)

### Fase 1: Preparação (Semana 1-2)

```bash
# 1. Criar projeto Neon
# neonctl projects create --name allcode-panel-prod

# 2. Provisionar Hyperdrive
wrangler hyperdrive create panel-audit \
  --connection-string="postgres://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb" \
  --caching=disabled

# 3. Adicionar binding no wrangler.jsonc
{
  "hyperdrive": [
    { "binding": "AUDIT_DB", "id": "<hyperdrive-id>" }
  ]
}
```

### Fase 2: Dual-Write (Semana 2-3)

```typescript
// src/lib/audit-db.ts - Novo módulo para PostgreSQL via Hyperdrive
import { env } from "./env"

export interface AuditDB {
  session: {
    upsert(input: SessionAuditInput): Promise<SessionAudit>
    listByOrg(orgID: string, opts: ListOptions): Promise<SessionAudit[]>
    getOrgKPIs(orgID: string): Promise<KPIs>
    getUserModelUsage(userID: string, days: number): Promise<ModelUsage[]>
  }
  event: {
    log(input: AuditEventInput): Promise<AuditEvent>
    list(orgID?: string, limit?: number): Promise<AuditEvent[]>
  }
}

export function auditDB(): AuditDB {
  const conn = env("AUDIT_DB") // Hyperdrive connection string
  // Usar `postgres` driver (node-postgres) via Hyperdrive
  // Hyperdrive expõe TCP socket compatível com pg
}
```

**Modificar `d1Store` para dual-write:**
```typescript
// Em d1Store.sessions.create()
async create(input) {
  // 1. Escrever no D1 (existente)
  const result = await d1Upsert(input)
  
  // 2. Async fire-and-forget para PostgreSQL (não bloqueia resposta)
  auditDB().session.upsert(input).catch(err => 
    console.error("Audit DB sync failed", err)
  )
  
  return result
}
```

### Fase 3: Backfill Histórico (Semana 3)

```bash
# Script de migração em lote (paginado)
# packages/panel/script/migrate-to-pg.ts

import { Database } from "bun:sqlite"
import { neon } from "@neondatabase/serverless"

const d1 = new Database("path/to/local.d1.sqlite")  -- ou dump remoto
const pg = neon(process.env.NEON_DATABASE_URL!)

const BATCH = 1000
let offset = 0

while (true) {
  const rows = d1.prepare(`
    SELECT * FROM session_audit 
    ORDER BY started_at ASC 
    LIMIT ? OFFSET ?
  `).all(BATCH, offset) as SessionAuditRow[]
  
  if (rows.length === 0) break
  
  await pg`
    INSERT INTO session_audit (...) VALUES ${pg(rows)}
    ON CONFLICT (session_id) DO UPDATE SET ...
  `
  
  offset += BATCH
  console.log(`Migrated ${offset} rows`)
}
```

### Fase 4: Cutover de Leitura (Semana 4)

```typescript
// Atualizar actions.ts para ler do PostgreSQL
export const getOrgSessions = query(async (options) => {
  const actor = await requireUser()
  // Lê do PostgreSQL via Hyperdrive (rápido, com índices)
  return auditDB().session.listByOrg(actor.orgID, options)
}, "panel.org.sessions")

export const getOrgKPIs = query(async () => {
  const actor = await requireUser()
  // Lê da materialized view (sub-ms)
  return auditDB().session.getOrgKPIs(actor.orgID)
}, "panel.org.kpis")
```

### Fase 5: Descomissionar D1 para Auditoria (Semana 5+)

- Remover `session_audit` e `audit_event` do D1
- Manter D1 apenas para: `organization`, `panel_user`, `provider_*`, `access_group`, `plan`, `reseller`
- D1 fica ~100MB, bem dentro dos limites

---

## 5. Estimativa de Custo (Mensal, USD)

| Componente | Desenvolvimento | Produção (1000 users) | Produção (5000 users) |
|------------|-----------------|----------------------|----------------------|
| **Cloudflare Workers** | $0 (free tier) | $5-15 | $15-30 |
| **Cloudflare D1** | $0 (free tier) | $0.50-2 | $2-5 |
| **Cloudflare R2** | $0 | $0.50-2 | $2-5 |
| **Neon PostgreSQL** | $0 (free tier) | $19-39 (Scale plan) | $69-159 |
| **Hyperdrive** | Incluído no Workers | Incluído | Incluído |
| **Total estimado** | **$0** | **$25-58** | **$88-199** |

*Comparação: D1-only com sharding manual = engenharia ~$5000+ + risco operacional*

---

## 6. Trade-offs: Híbrido vs. D1 com Sharding

| Critério | **Híbrido (D1 + Neon)** | **D1 Sharding (1 DB/tenant)** |
|----------|-------------------------|-------------------------------|
| **Escrita audit** | ✅ PostgreSQL nativo (concorrente) | ❌ Single-writer por DB |
| **Leitura/Analytics** | ✅ Índices, particionamento, MV, FTS | ❌ Full scan, sem FTS |
| **Operação** | ✅ 1 PostgreSQL gerenciado | ❌ N bancos D1 (migrações, backup, monitor) |
| **Custo infra** | ~$25-60/mês | ~$5/tenant/mês = $5000+/mês (1000 tenants) |
| **Latência escrita** | ~5-15ms (Hyperdrive) | ~1-5ms (D1 local) |
| **Latência leitura KPI** | ~1-5ms (MV) | ~100-5000ms (full scan) |
| **Isolamento tenant** | Row-level security (RLS) | Físico (DB separado) |
| **Compliance (LGPD)** | RLS + criptografia | Mais simples (isolamento físico) |
| **Tempo para implementar** | 3-4 semanas | 8-12 semanas + manutenção contínua |
| **Risco técnico** | Baixo (PostgreSQL padrão) | Alto (sharding manual, sem ferramentas) |

### Quando D1 Sharding Faz Sentido
- < 50 tenants, todos pequenos (< 50 users)
- Requisito regulatório de isolamento físico de dados
- Team com expertise forte em operações D1 distribuído

---

## 7. Checklist de Implementação

- [ ] Provisionar Neon project (prod + preview branches)
- [ ] Criar Hyperdrive binding no Workers
- [ ] Implementar `auditDB` module com `postgres` driver
- [ ] Adicionar dual-write em `d1Store.sessions.create` e `d1Store.audit.log`
- [ ] Criar schema PostgreSQL particionado + índices + MVs
- [ ] Script de backfill histórico (idempotente, resumível)
- [ ] Migrar queries de leitura (`actions.ts`) para `auditDB`
- [ ] Testes de carga (k6/wrk) simulando 1000 users concurrentes
- [ ] Monitoramento: latency p50/p99, error rate, Hyperdrive pool health
- [ ] Cutover gradual (feature flag por org)
- [ ] Remover tabelas de auditoria do D1 + migrations de limpeza
- [ ] Documentar runbooks: PITR, partition maintenance, MV refresh

---

## 8. Próximos Passos Imediatos

1. **Criar conta Neon** e testar Hyperdrive localmente (`wrangler dev --remote`)
2. **Validar latência** Workers → Hyperdrive → Neon (target < 20ms p99)
3. **Prototype** do módulo `auditDB` com dual-write
4. **Estimar volume real** de `session_audit` via logs atuais

---

*Documento gerado em 2026-11-04 baseado na análise do código em `packages/panel` (migrations 0001-0013, store.ts, actions.ts, API routes).*