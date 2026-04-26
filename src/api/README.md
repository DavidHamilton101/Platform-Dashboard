# api

Internal REST API built with Express. Serves processed data to the dashboard.

## Responsibilities

- Expose read-only endpoints for usage, cost, anomaly, and forecast data
- Authenticate requests using the `DASHBOARD_API_KEY` bearer token
- Return structured JSON responses; never expose raw Supabase rows directly
- Surface errors via appropriate HTTP status codes and typed error responses

## Phase 1 scope

- Health check endpoint: `GET /health`
- Stub endpoints for usage and cost data (implemented in Phase 2/3)

## What this module does NOT do

- Fetch from the Anthropic Admin API — that is `/src/ingestion`'s responsibility
- Write to the database — that is `/src/storage`'s responsibility
