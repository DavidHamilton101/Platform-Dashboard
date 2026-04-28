-- Stores per-scenario forecast data points produced by each forecast run.

CREATE TABLE IF NOT EXISTS forecast_results (
  id                 uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id             uuid          NOT NULL,
  generated_at       timestamptz   NOT NULL DEFAULT now(),
  horizon_days       int           NOT NULL,
  scenario           text          NOT NULL CHECK (scenario IN ('low', 'medium', 'high')),
  forecast_date      date          NOT NULL,
  predicted_cost_usd numeric(12,6) NOT NULL
);

CREATE INDEX IF NOT EXISTS forecast_results_run_id_idx ON forecast_results (run_id);
CREATE INDEX IF NOT EXISTS forecast_results_scenario_date_idx ON forecast_results (scenario, forecast_date);

ALTER TABLE forecast_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON forecast_results
  USING (true)
  WITH CHECK (true);

-- Stores point-in-time model efficiency snapshots (cost per million tokens).

CREATE TABLE IF NOT EXISTS model_efficiency_snapshots (
  id                       uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_at              timestamptz   NOT NULL DEFAULT now(),
  model                    text          NOT NULL,
  cost_per_million_tokens  numeric(12,6) NOT NULL,
  total_cost_usd           numeric(12,4) NOT NULL,
  total_tokens             bigint        NOT NULL,
  analysis_days            int           NOT NULL
);

CREATE INDEX IF NOT EXISTS model_efficiency_model_idx ON model_efficiency_snapshots (model);

ALTER TABLE model_efficiency_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON model_efficiency_snapshots
  USING (true)
  WITH CHECK (true);
