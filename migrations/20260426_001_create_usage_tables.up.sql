-- UP: Create ai_usage_daily, ai_cost_daily, and ingestion_log tables
-- Rollback: run 20260426_001_create_usage_tables.down.sql

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id                          BIGSERIAL PRIMARY KEY,
  recorded_at                 TIMESTAMPTZ NOT NULL,
  organization_id             TEXT        NOT NULL,
  workspace_id                TEXT        NOT NULL DEFAULT 'default',
  model                       TEXT        NOT NULL,
  input_tokens                BIGINT      NOT NULL DEFAULT 0,
  output_tokens               BIGINT      NOT NULL DEFAULT 0,
  cache_creation_input_tokens BIGINT      NOT NULL DEFAULT 0,
  cache_read_input_tokens     BIGINT      NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_usage_daily_upsert_key UNIQUE (recorded_at, model, workspace_id)
);

CREATE TABLE IF NOT EXISTS ai_cost_daily (
  id              BIGSERIAL PRIMARY KEY,
  recorded_at     TIMESTAMPTZ NOT NULL,
  organization_id TEXT        NOT NULL,
  workspace_id    TEXT        NOT NULL DEFAULT 'default',
  model           TEXT,
  cost_type       TEXT        NOT NULL,
  amount_usd      NUMERIC(12, 6) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_cost_daily_upsert_key UNIQUE (recorded_at, workspace_id, model, cost_type)
);

CREATE TABLE IF NOT EXISTS ingestion_log (
  id             BIGSERIAL PRIMARY KEY,
  ingestion_type TEXT        NOT NULL,
  last_fetched_at TIMESTAMPTZ NOT NULL,
  records_written INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_recorded_at_model
  ON ai_usage_daily (recorded_at, model);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_recorded_at_workspace
  ON ai_usage_daily (recorded_at, workspace_id);

CREATE INDEX IF NOT EXISTS idx_ai_cost_daily_recorded_at_workspace
  ON ai_cost_daily (recorded_at, workspace_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_type_fetched
  ON ingestion_log (ingestion_type, last_fetched_at);
