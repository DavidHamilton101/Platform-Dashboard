# storage

Supabase write layer. Persists validated ingestion records to the database.

## Responsibilities

- Accept validated records from `/src/ingestion`
- Write to Supabase using the service role key (server-side only)
- Handle upsert logic to avoid duplicate records on re-ingestion
- Surface write failures via `StorageError`

## Security

- The Supabase service role key bypasses Row Level Security — use it only here
- All tables written by this module must have RLS enabled
- No PII is stored alongside usage data — anonymised session IDs only

## What this module does NOT do

- Fetch from external APIs — that is `/src/ingestion`'s responsibility
- Expose data to the dashboard — that is `/src/api`'s responsibility
