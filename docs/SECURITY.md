# Security — Credentials and Key Rotation

## Credential Inventory

| Key | Scope | Where Used | Never |
|---|---|---|---|
| `ANTHROPIC_ADMIN_API_KEY` | Read-only usage and cost endpoints | Server-side ingestion only | Expose in client code or logs |
| `SUPABASE_SERVICE_ROLE_KEY` | Full database access, bypasses RLS | Server-side API only | Use in browser or expose via client SDK |
| `DASHBOARD_API_KEY` | Bearer token for internal dashboard API | Internal service-to-service calls | Commit to source code |
| `ALERT_WEBHOOK_URL` | POST-only webhook for alerts | CI/CD and monitoring only | Log request payloads containing this URL |

## Anthropic Admin API Key

- Request with **read-only** scope for usage and cost endpoints only.
- Do not request write or model-management permissions.
- If the key is ever exposed, rotate immediately and audit recent API calls via the Anthropic console.

## Supabase Service Role Key

- Bypasses all Row Level Security policies — treat it with the same sensitivity as a database root password.
- Only used in server-side code; must never be included in any client-side bundle.
- All new tables must have RLS enabled; the service role key is the exception for trusted server operations, not the rule.

## Rotation Procedure

Follow these steps to rotate any credential safely:

1. **Generate** the new credential in the relevant system (Anthropic console, Supabase dashboard, etc.).
2. **Update GitHub Actions secret** — go to `Settings → Secrets and variables → Actions` and update the value. Do not delete the old one yet.
3. **Update the environment** — update `.env.staging` on the server, restart the service, and confirm the health endpoint responds correctly.
4. **Verify** — run a manual ingestion or health check to confirm the new key is functional.
5. **Promote to production** — repeat steps 3–4 for the production environment.
6. **Revoke the old key** — only after both environments are confirmed healthy.
7. **Record the rotation** — note the date in your team's audit log.

## Recommended Rotation Frequency

| Credential | Frequency |
|---|---|
| `ANTHROPIC_ADMIN_API_KEY` | Every 90 days, or immediately on suspected exposure |
| `SUPABASE_SERVICE_ROLE_KEY` | Every 90 days, or immediately on suspected exposure |
| `DASHBOARD_API_KEY` | Every 90 days, or on team member offboarding |
| `ALERT_WEBHOOK_URL` | On webhook provider change or suspected exposure |

## Secret Scanning

TruffleHog runs on every push to every branch (see `.github/workflows/security.yml`).
If it fires on `main` or `develop`, an automated alert is sent to `ALERT_WEBHOOK_URL`.
Treat any TruffleHog alert as a live incident until confirmed otherwise.
