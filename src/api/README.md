# src/api — Dashboard REST API

Internal REST API serving usage, anomaly, and forecast data to the frontend dashboard.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Service status and Supabase connectivity |
| GET | /usage/summary | Token usage summary by model and workspace |
| GET | /usage/daily | Daily token usage series |
| GET | /usage/costs | Daily cost series |
| GET | /usage/costs/workspace | Cost breakdown by workspace |
| GET | /anomalies/recent | Recent anomaly alerts (default: last 20) |
| GET | /anomalies/log | Full alert log (default: last 100) |
| GET | /forecasts/latest | Latest forecast run results (all scenarios) |
| GET | /forecasts/efficiency | Latest model efficiency snapshots |

## Authentication

All endpoints require a bearer token:

```
Authorization: Bearer <DASHBOARD_API_KEY>
```

Unauthenticated requests return `401 Unauthorized`.

## Rate Limiting

60 requests per minute per IP. Exceeded requests return `429 Too Many Requests`.

## Query Parameters

Usage and cost endpoints accept an optional `days` parameter (default: 30):

```
GET /usage/summary?days=7
```

Anomaly endpoints accept an optional `limit` parameter:

```
GET /anomalies/recent?limit=50
GET /anomalies/log?limit=200
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DASHBOARD_API_KEY` | Yes | Bearer token for API authentication |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `API_PORT` | No | Port to listen on (default: 3000) |

## Starting the Server

```bash
npx ts-node src/api/server.ts
```

## Module Structure

```
src/api/
├── index.ts              # App factory (exported for testing)
├── server.ts             # Entry point — starts the HTTP server
├── middleware/
│   ├── auth.ts           # Bearer token authentication
│   ├── rate-limit.ts     # In-memory 60 req/min per IP limiter
│   └── request-logger.ts # Structured request logging via pino
└── routes/
    ├── health.ts         # /health
    ├── usage.ts          # /usage/*
    ├── anomalies.ts      # /anomalies/*
    └── forecasts.ts      # /forecasts/*
```

## What this module does NOT do

- Fetch from the Anthropic Admin API — that is `/src/ingestion`'s responsibility
- Write to the database — that is `/src/storage`'s responsibility
- Manage auth users or sessions — DASHBOARD_API_KEY is a shared internal service token
