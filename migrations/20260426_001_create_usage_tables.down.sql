-- DOWN: Drop ai_usage_daily, ai_cost_daily, and ingestion_log tables
-- Rollback for: 20260426_001_create_usage_tables.up.sql
-- WARNING: This is destructive — all ingested data will be lost.

DROP TABLE IF EXISTS ingestion_log;
DROP TABLE IF EXISTS ai_cost_daily;
DROP TABLE IF EXISTS ai_usage_daily;
