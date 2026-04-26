# Architecture — Candle Shack AI Cost & Usage Intelligence Platform

## System Overview

This platform ingests AI usage and cost data from the Anthropic Admin API,
stores it in Supabase, runs analysis, and serves it through a REST API to
a dashboard. In Phase 3, the dashboard will also consolidate data from
Vercel's reporting API to provide a single view of all AI spend.

## Data Flow

```
┌─────────────────────┐     scheduled      ┌──────────────────┐
│  Anthropic Admin API │ ─────────────────► │  /src/ingestion  │
│  (usage + costs)     │                    │  Fetch & validate│
└─────────────────────┘                    └────────┬─────────┘
                                                    │ validated records
                                                    ▼
                                           ┌──────────────────┐
                                           │  /src/storage    │
                                           │  Supabase writes │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │  Supabase (DB)   │
                                           │  PostgreSQL + RLS│
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │  /src/analysis   │
                                           │  Anomalies &     │
                                           │  forecasting     │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐
                                           │  /src/api        │
                                           │  Express REST    │
                                           └────────┬─────────┘
                                                    │
                                                    ▼
                                           ┌──────────────────┐     ┌──────────────────────┐
                                           │  Dashboard       │◄────│  Vercel Reporting API │
                                           │  (Phase 3)       │     │  (Phase 3, read-only) │
                                           └──────────────────┘     └──────────────────────┘
```

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `/src/ingestion` | Fetch and validate raw data from Anthropic Admin API |
| `/src/storage` | Write validated records to Supabase |
| `/src/analysis` | Anomaly detection (Phase 2), forecasting (Phase 3) |
| `/src/api` | Serve processed data to the dashboard via REST |
| `/src/utils` | Shared env validation, logging, and error types |

## Key Decisions

### Supabase as the persistence layer
Supabase provides PostgreSQL with built-in Row Level Security, a generous
free tier, and a TypeScript client. RLS is enabled on all tables — the
service role key (which bypasses RLS) is restricted to `/src/storage` only.

### Pino for structured logging
JSON logs in production enable log aggregation and querying. All credential
fields are redacted at the logger level so they can never appear in output,
regardless of what callers pass.

### Zod for environment validation
All environment variables are validated on startup with Zod. The application
fails fast with clear error messages if configuration is incomplete. Values
are never logged — only the names of missing or invalid variables.

### Express for the API layer
Express v4 is a stable, well-understood choice for a small internal API.
It will serve a dashboard frontend and, later, provide webhook endpoints
for n8n alerting integrations.

### node-cron for scheduled ingestion
Keeps the ingestion schedule co-located with the application. Can be
replaced with a Supabase Edge Function or external scheduler in Phase 2
if deployment requirements change.

## Phase Roadmap

| Phase | Scope |
|---|---|
| Phase 1 | Data ingestion from Anthropic Admin API → Supabase storage |
| Phase 2 | Anomaly detection, threshold alerts, n8n webhook integration |
| Phase 3 | Forecasting, model optimisation recommendations, Vercel data consolidation, unified dashboard |
| Phase 4 | Model optimisation recommendations surfaced in dashboard |

## Phase 3 — Vercel Integration

Vercel already provides platform monitoring, per-user spend limiting, and
model usage reporting. The Phase 3 dashboard must **consume Vercel's reporting
API** rather than rebuild what it provides. Build only what Vercel does not:
cost-per-feature attribution, growth forecasting, and model optimisation advice.
The goal is one place for all AI cost intelligence — not two dashboards.

## Security Boundary

See [`SECURITY.md`](./SECURITY.md) for credential scopes and rotation procedures.

- The Anthropic Admin API key is read-only: usage and cost endpoints only
- The Supabase service role key is used only in `/src/storage`
- The dashboard API key authenticates all `/src/api` requests
- No user PII is stored alongside usage data — anonymised session IDs only
