# CLAUDE.md — Candle Shack AI Cost & Usage Intelligence Platform

## Project Overview
Build a usage monitoring, cost tracking, and growth forecasting
system integrated into the Candle Shack platform. Pulls data from
the Anthropic Admin API and correlates with Supabase user data.

## Architecture Principles
- Security first: no secrets in code, credentials via env vars only
- Modular: each component independently testable
- Documented: every module gets a README and inline comments
- Typed: TypeScript throughout

## Security Requirements
- All keys in .env, never committed
- Supabase RLS enabled on all new tables
- No user PII alongside usage data — anonymised session IDs only
- Admin API key scoped to read-only usage/cost endpoints

## Project Phases
Phase 1: Data ingestion and storage
Phase 2: Anomaly detection and alerting
Phase 3: Forecasting and dashboards
Phase 4: Model optimisation recommendations

## Instructions
- Never hardcode secrets
- Write migration UP and DOWN files for all schema changes
- Add README.md to every new directory
- Commit logical units with clear conventional commit messages
- Always confirm current branch before writing code

## Additional Context

### Alerting Strategy
Initial alert destination: Microsoft Teams webhook
(already available via Microsoft 365 MCP connection —
no additional infrastructure required)

The alerting module must be designed to accept any
webhook URL via environment variable so the destination
can be changed without code changes.

When multi-destination routing is required — for example:
- Cost and budget alerts → Stuart Rae (Finance Director)
- Security and architecture alerts → Duncan MacLean (CEO/TDA)
- Anomaly and operational alerts → David Hamilton (IT Director)

Introduce n8n as the routing layer at that point. Do not
build an n8n dependency into the alerting module until
multi-destination routing is confirmed as a requirement.

Update the ALERT_WEBHOOK_URL GitHub Actions secret to
the Microsoft Teams webhook URL before any code reaches
main. The current value is a placeholder.
