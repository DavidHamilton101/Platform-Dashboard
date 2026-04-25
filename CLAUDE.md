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
