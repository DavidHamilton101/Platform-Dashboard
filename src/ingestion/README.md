# ingestion

Fetches usage and cost data from the Anthropic Admin API on a scheduled basis.

## Responsibilities

- Authenticate with the Anthropic Admin API using a read-only admin key
- Fetch usage events, token counts, and cost data per workspace and model
- Validate and normalise the raw API response before passing to storage
- Retry on transient failures; surface permanent failures via `ApiError`

## Phase 1 scope

- Scheduled ingestion job (via `node-cron`)
- Fetch `/v1/usage` and `/v1/costs` endpoints
- Pass validated records to `/src/storage`

## What this module does NOT do

- Write directly to Supabase — that is `/src/storage`'s responsibility
- Perform analysis or anomaly detection — that is `/src/analysis`
