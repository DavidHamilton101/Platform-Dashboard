# ingestion

Fetches usage and cost data from the Anthropic Admin API on a scheduled basis.

## Files

| File | Purpose |
|---|---|
| `types.ts` | TypeScript interfaces for all Anthropic Admin API request/response shapes and shared ingestion types |
| `http-client.ts` | Core HTTP fetch function with retry and exponential backoff for 429/5xx responses |
| `anthropic-usage.ts` | Fetches daily usage buckets (tokens by model/workspace) with automatic pagination |
| `anthropic-costs.ts` | Fetches daily cost records with description parsing to extract model and feature context |
| `scheduler.ts` | Cron-based scheduler; runs usage ingestion hourly and cost ingestion daily at 02:00. Guards against duplicate runs via `IngestionStateStore` |

## Anthropic Admin API endpoints

| Endpoint | Method | Used by |
|---|---|---|
| `/v1/organizations/usage_report/messages` | GET | `anthropic-usage.ts` |
| `/v1/organizations/cost_report` | GET | `anthropic-costs.ts` |

Both endpoints are called with:
- `x-api-key` header containing the admin API key
- `anthropic-version: 2023-06-01` header
- `start_time` / `end_time` query params (ISO 8601) for a rolling 30-day window
- `bucket_width=1d` for daily granularity (usage only)
- `limit=100` with cursor-based pagination via `after_id`

> **Note:** These endpoint paths are defined in `http-client.ts` and each API module. Verify against the Anthropic Admin API reference before first deployment — field names may vary by API version.

## Required environment variables

All variables are validated on startup by `src/utils/env-validator.ts`.

| Variable | Description |
|---|---|
| `ANTHROPIC_ADMIN_API_KEY` | Read-only Anthropic Admin API key. Never logged — only its presence is confirmed. |
| `ENVIRONMENT` | One of `development`, `staging`, `production`. Controls log format and level. |

See `.env.example` in the project root for all required variables.

## Alerting

Alert webhook destination is configured via `ALERT_WEBHOOK_URL` environment variable.
Current target: Microsoft Teams webhook (no additional infrastructure required).
The alerting module has no hardcoded destination — changing the variable changes the target.
See `docs/SECURITY.md` for rotation procedure.

## Duplicate detection

The scheduler checks `IngestionStateStore.getLastRunAt()` before each run:
- Usage runs are skipped if the last run was less than 55 minutes ago
- Cost runs are skipped if the last run was less than 23 hours ago

`IngestionStateStore` is an interface — the Supabase implementation is wired in the storage PR.

## Running ingestion manually (for testing)

> Full CLI tooling is added in a later phase. Until then, call the functions directly.

```typescript
import { fetchUsageReport, groupByModelAndWorkspace } from './src/ingestion/anthropic-usage';
import { fetchCostReport } from './src/ingestion/anthropic-costs';

const now = new Date();
const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

// Usage
const buckets = await fetchUsageReport(start, now);
const groups = groupByModelAndWorkspace(buckets);
console.log(`Fetched ${buckets.length} usage buckets across ${groups.size} model/workspace groups`);

// Costs
const records = await fetchCostReport(start, now);
console.log(`Fetched ${records.length} cost records`);
```

Ensure the relevant environment variables are set before running.
