# Runbook — Candle Shack AI Cost & Usage Intelligence Platform

## 1. Setting Up a New Environment from Scratch

### Prerequisites
- Node.js 20+
- Access to Supabase project for the target environment
- Anthropic Admin API key with read-only usage/cost scope
- A webhook URL for alerts (e.g. Slack incoming webhook)

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/DavidHamilton101/Platform-Dashboard.git
   cd Platform-Dashboard
   ```

2. **Create the environment file**
   ```bash
   cp .env.example .env.development   # or .env.staging / .env.production
   ```
   Fill in all values. See `.env.example` for descriptions of each key.

3. **Install dependencies**
   ```bash
   npm ci
   ```

4. **Run database migrations**
   Apply each migration in order against the target Supabase project.
   See [`/migrations/README.md`](../migrations/README.md) for naming conventions and rules.
   Always run against staging before production.

5. **Verify the setup**
   ```bash
   # To be added in Phase 1 once the health endpoint is implemented
   curl http://localhost:3000/health
   ```

---

## 2. Rotating API Keys Safely

See [`/docs/SECURITY.md`](./SECURITY.md#rotation-procedure) for the full rotation procedure.

**Quick reference:**
1. Generate new key in the relevant system
2. Update the GitHub Actions secret
3. Update `.env.staging`, verify health endpoint
4. Promote to production, verify health endpoint
5. Revoke the old key only after both environments confirm healthy

---

## 3. Manually Triggering an Ingestion Run

> **Placeholder — to be updated in Phase 1** once the ingestion module is implemented.

Once implemented, the ingestion run will be triggered as follows:

```bash
# Command to be confirmed in Phase 1
npm run ingest
```

For production, use the scheduled job rather than manual runs where possible.
If a manual run is required in production, record the reason and timestamp in the team audit log.

---

## 4. What to Do When an Alert Fires

### Cost threshold alert (`COST_ALERT_THRESHOLD_USD` exceeded)

1. Check the dashboard for the spike — identify which model, workspace, or time window is responsible.
2. If caused by a runaway process, stop the ingestion job and investigate.
3. If expected (e.g. load test), acknowledge the alert and document the reason.
4. Adjust `COST_ALERT_THRESHOLD_USD` if the current threshold is no longer appropriate.

### TruffleHog secret detected

1. **Treat as a live incident immediately.**
2. Identify the commit and the exposed key from the TruffleHog output.
3. Rotate the affected key immediately — follow the procedure in [`/docs/SECURITY.md`](./SECURITY.md#rotation-procedure).
4. Audit recent API usage for the exposed key in the relevant system's console.
5. Remove the secret from git history using `git filter-repo` or contact GitHub support for assistance.
6. Post a retrospective note to the team documenting what happened and what was changed.

### CI failure on `main` or `develop`

1. Do not merge any further PRs until the failure is understood.
2. Check the GitHub Actions run log for the specific failing step.
3. If a dependency vulnerability: update the affected package and open a hotfix PR.
4. If a test failure: identify the regressing commit and open a hotfix PR targeting `develop`.
