# storage

Supabase-backed persistence layer for ingested usage and cost data.

## Files

| File | Purpose |
|---|---|
| `supabase-writer.ts` | `SupabaseWriter` class — upserts usage buckets and cost records; writes ingestion log entries |
| `supabase-reader.ts` | `SupabaseReader` class — query functions for the dashboard API |
| `ingestion-state-store.ts` | `SupabaseIngestionStateStore` — implements `IngestionStateStore` from the scheduler, closing the deferred item from the ingestion PR |

## Schema overview

Three tables are created by `migrations/20260426_001_create_usage_tables.up.sql`:

| Table | Purpose |
|---|---|
| `ai_usage_daily` | Daily token usage buckets per model and workspace |
| `ai_cost_daily` | Daily cost records per model, workspace, and cost type |
| `ingestion_log` | Audit trail of every ingestion run; also drives duplicate detection |

### Upsert keys

Both write tables use deterministic composite unique constraints to make every upsert idempotent. Re-running ingestion for the same window never creates duplicate rows.

| Table | Upsert key | Rationale |
|---|---|---|
| `ai_usage_daily` | `(recorded_at, model, workspace_id)` | Usage buckets are uniquely identified by their time bucket, model, and workspace |
| `ai_cost_daily` | `(recorded_at, workspace_id, model, cost_type)` | Cost records are uniquely identified by date, workspace, model, and cost type (mapped from `feature` field) |

`workspace_id` defaults to `'default'` when the API returns null (organisation-level records).
`cost_type` defaults to `'unknown'` when the API returns a description with no parseable feature suffix.

## RLS policy decisions

Policies are applied by `migrations/20260426_002_add_rls_policies.up.sql`.

| Role | Tables | Permissions | Rationale |
|---|---|---|---|
| `service_role` | all three | INSERT, UPDATE | Server-side ingestion process; bypasses RLS via service role key; key is never logged |
| `authenticated` | all three | SELECT | Dashboard API reads; browser or server using a user JWT |
| `anon` | all three | none | No public/unauthenticated access |
| any role | all three | no DELETE | Preserves audit history; data correction is done via upsert, not deletion |

The service role key is accepted via the `SupabaseWriter` / `SupabaseIngestionStateStore` constructors — callers create the Supabase client and inject it, so the key never passes through the storage module itself.

## IngestionStateStore implementation

`SupabaseIngestionStateStore` closes the deferred item from the ingestion PR.

The scheduler calls `getLastRunAt(type)` before each run to check whether enough time has elapsed since the last successful run. State is stored in `ingestion_log`:
- `getLastRunAt` — queries the most recent row for the given `ingestion_type`
- `setLastRunAt` — inserts a new row with `records_written: 0` (a dedicated state record, separate from the batch log entries written by `SupabaseWriter.writeIngestionLog`)

Both methods throw `StorageError` on Supabase errors, which the scheduler catches and logs.

## Applying migrations

Run migrations in order against the target Supabase project using the Supabase CLI or SQL editor:

```bash
# Apply
supabase db push  # or run each .up.sql file in order via the SQL editor

# Rollback (run in reverse order)
# 20260426_002_add_rls_policies.down.sql
# 20260426_001_create_usage_tables.down.sql
```

Always run against staging before production. See `migrations/README.md` for the full conventions.

## Verifying RLS

To confirm policies are active after migration, run in the Supabase SQL editor:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ai_usage_daily', 'ai_cost_daily', 'ingestion_log');
```

All three tables should show `rowsecurity = true`.

To list active policies:

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## Required environment variables

Both the writer and state store require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, validated on startup by `src/utils/env-validator.ts`. See `.env.example` in the project root.
