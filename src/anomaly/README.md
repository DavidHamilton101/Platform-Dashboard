# anomaly

Anomaly detection and Microsoft Teams alerting for the Candle Shack AI Cost & Usage Intelligence Platform.

## Detectors

| Detector | File | Trigger |
|---|---|---|
| Token spike | `token-spike-detector.ts` | Today's tokens exceed rolling average × multiplier, or an absolute threshold |
| Cost anomaly | `cost-anomaly-detector.ts` | Daily spend exceeds rolling average × multiplier, daily threshold, or period total threshold |
| Agent loop | `agent-loop-detector.ts` | Single-bucket token count exceeds threshold, or output/input ratio exceeds threshold |

## Alerting

`teams-alerter.ts` posts a Teams MessageCard to the webhook configured in `ALERT_WEBHOOK_URL`.
All alert events are written to the `alert_log` Supabase table via `SupabaseWriter.writeAlertLog`.

## Runner

`anomaly-runner.ts` orchestrates a full detection cycle:
1. Reads daily usage and cost series from `SupabaseReader`
2. Runs all three detectors
3. Fires a Teams alert and writes an `alert_log` row for every anomaly found

Invoke from a scheduled job or the API layer:

```typescript
const runner = new AnomalyRunner(reader, writer, alerter);
const anomalies = await runner.run({ lookbackDays: 8 });
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ALERT_WEBHOOK_URL` | Yes | — | Microsoft Teams incoming webhook URL |
| `COST_ALERT_THRESHOLD_USD` | Yes | — | Daily spend (USD) that triggers a critical cost alert |
| `TOKEN_SPIKE_WINDOW_DAYS` | No | `7` | Rolling window used to build the token baseline |
| `TOKEN_SPIKE_MULTIPLIER` | No | `3` | Multiple of baseline that triggers a warning |
| `TOKEN_SPIKE_THRESHOLD` | No | `1000000` | Absolute daily token count that triggers a critical alert |
| `COST_SPIKE_MULTIPLIER` | No | `3` | Multiple of baseline daily spend that triggers a warning |
| `AGENT_LOOP_TOKEN_THRESHOLD` | No | `500000` | Tokens in a single bucket that indicate a runaway loop |
| `AGENT_LOOP_RATIO_THRESHOLD` | No | `10` | Output/input token ratio that indicates a runaway loop |

## Schema

Migration `20260428_003_create_alert_log` creates the `alert_log` table with RLS enabled.
