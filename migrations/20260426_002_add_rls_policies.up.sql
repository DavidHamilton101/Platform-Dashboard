-- UP: Enable RLS and add access policies on all three tables
-- Rollback: run 20260426_002_add_rls_policies.down.sql
--
-- Policy decisions:
--   service_role  — INSERT + UPDATE only (no DELETE; upsert idempotency is handled via ON CONFLICT)
--   authenticated — SELECT only (dashboard reads; no writes from the browser layer)
--   No anon access on any table.

-- ─── ai_usage_daily ──────────────────────────────────────────────────────────

ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can insert usage"
  ON ai_usage_daily FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role can update usage"
  ON ai_usage_daily FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "authenticated users can read usage"
  ON ai_usage_daily FOR SELECT
  TO authenticated
  USING (true);

-- ─── ai_cost_daily ───────────────────────────────────────────────────────────

ALTER TABLE ai_cost_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can insert costs"
  ON ai_cost_daily FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role can update costs"
  ON ai_cost_daily FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "authenticated users can read costs"
  ON ai_cost_daily FOR SELECT
  TO authenticated
  USING (true);

-- ─── ingestion_log ───────────────────────────────────────────────────────────

ALTER TABLE ingestion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can insert ingestion log"
  ON ingestion_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role can update ingestion log"
  ON ingestion_log FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "authenticated users can read ingestion log"
  ON ingestion_log FOR SELECT
  TO authenticated
  USING (true);
