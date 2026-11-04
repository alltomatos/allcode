CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS session_audit (
    id UUID DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    title TEXT,
    summary TEXT NOT NULL,
    workspace TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    tokens_total BIGINT NOT NULL DEFAULT 0,
    tokens_input BIGINT NOT NULL DEFAULT 0,
    tokens_output BIGINT NOT NULL DEFAULT 0,
    tokens_reasoning BIGINT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    messages_count INT NOT NULL DEFAULT 0,
    model_usage JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, started_at)
) PARTITION BY RANGE (started_at);

CREATE TABLE IF NOT EXISTS audit_event (
    id UUID DEFAULT gen_random_uuid(),
    org_id TEXT NOT NULL,
    actor_id TEXT,
    actor_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    result TEXT NOT NULL CHECK (result IN ('allow', 'deny')),
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, at)
) PARTITION BY RANGE (at);

DO $$
DECLARE
    i INT;
    start_date DATE := date_trunc('month', now())::date - INTERVAL '2 month';
BEGIN
    FOR i IN 0..24 LOOP
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS session_audit_%s PARTITION OF session_audit
             FOR VALUES FROM (%L) TO (%L);',
            to_char(start_date + (i || ' month')::interval, 'YYYY_MM'),
            start_date + (i || ' month')::interval,
            start_date + ((i+1) || ' month')::interval
        );
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS audit_event_%s PARTITION OF audit_event
             FOR VALUES FROM (%L) TO (%L);',
            to_char(start_date + (i || ' month')::interval, 'YYYY_MM'),
            start_date + (i || ' month')::interval,
            start_date + ((i+1) || ' month')::interval
        );
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_audit_org_started ON session_audit (org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_audit_user_started ON session_audit (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_audit_session_id ON session_audit (session_id);
CREATE INDEX IF NOT EXISTS idx_session_audit_search_trgm ON session_audit USING GIN (title gin_trgm_ops, summary gin_trgm_ops, workspace gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_audit_event_org_at ON audit_event (org_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_target ON audit_event (target_id, at DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS kpi_org_daily AS
SELECT
    org_id,
    date_trunc('day', started_at)::date AS day,
    COUNT(*) AS total_sessions,
    SUM(tokens_total) AS total_tokens,
    SUM(cost_usd) AS total_cost_usd,
    SUM(duration_ms) AS total_duration_ms,
    COUNT(DISTINCT user_id) AS active_users
FROM session_audit
GROUP BY org_id, date_trunc('day', started_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_org_daily ON kpi_org_daily (org_id, day);

CREATE MATERIALIZED VIEW IF NOT EXISTS kpi_model_usage_daily AS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_model_usage_daily ON kpi_model_usage_daily (org_id, day, provider_id, model_id);

CREATE OR REPLACE FUNCTION refresh_allcode_kpis() RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY kpi_org_daily;
    REFRESH MATERIALIZED VIEW CONCURRENTLY kpi_model_usage_daily;
END $$ LANGUAGE plpgsql;
