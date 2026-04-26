-- DOWN: Drop all RLS policies and disable RLS on all three tables
-- Rollback for: 20260426_002_add_rls_policies.up.sql

-- ─── ingestion_log ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can read ingestion log" ON ingestion_log;
DROP POLICY IF EXISTS "service_role can update ingestion log"       ON ingestion_log;
DROP POLICY IF EXISTS "service_role can insert ingestion log"       ON ingestion_log;
ALTER TABLE ingestion_log DISABLE ROW LEVEL SECURITY;

-- ─── ai_cost_daily ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can read costs" ON ai_cost_daily;
DROP POLICY IF EXISTS "service_role can update costs"      ON ai_cost_daily;
DROP POLICY IF EXISTS "service_role can insert costs"      ON ai_cost_daily;
ALTER TABLE ai_cost_daily DISABLE ROW LEVEL SECURITY;

-- ─── ai_usage_daily ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can read usage" ON ai_usage_daily;
DROP POLICY IF EXISTS "service_role can update usage"      ON ai_usage_daily;
DROP POLICY IF EXISTS "service_role can insert usage"      ON ai_usage_daily;
ALTER TABLE ai_usage_daily DISABLE ROW LEVEL SECURITY;
