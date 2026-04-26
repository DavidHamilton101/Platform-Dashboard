# analysis

Anomaly detection (Phase 2) and growth forecasting (Phase 3).

## Responsibilities

- Read persisted usage data from Supabase
- Detect anomalies: spend spikes, unusual model usage patterns, threshold breaches
- Produce forecasts: projected monthly costs, growth trends
- Write analysis results back to Supabase for the API layer to serve

## Phase roadmap

- **Phase 2**: Anomaly detection and alerting (threshold breach, spike detection)
- **Phase 3**: Forecasting, model optimisation recommendations, Vercel data consolidation

## What this module does NOT do

- Write raw ingestion data — that is `/src/storage`'s responsibility
- Serve data to the dashboard directly — that is `/src/api`'s responsibility
