# forecasting

Linear regression cost forecasting and model efficiency analysis for the Candle Shack AI Cost & Usage Intelligence Platform.

## Components

| File | Purpose |
|---|---|
| `linear-regression.ts` | Least-squares regression over daily cost data; returns slope, intercept, R² |
| `growth-scenarios.ts` | Projects regression output over a horizon under low / medium / high annual growth rates |
| `model-efficiency.ts` | Cost per million tokens by model, sorted cheapest-first |
| `forecast-runner.ts` | Orchestrates a full forecast run: reads history, fits model, generates scenarios, writes results |

## How it works

1. `ForecastRunner.run()` reads `FORECAST_HISTORY_DAYS` of daily cost data from `ai_cost_daily`
2. Fits a linear regression to the day-indexed cost series
3. Projects three growth scenarios over `FORECAST_HORIZON_DAYS` days, applying compound annual growth rates
4. Computes cost-per-million-tokens for each model using the same history window
5. Persists forecast data points to `forecast_results` and efficiency data to `model_efficiency_snapshots`

```typescript
const runner = new ForecastRunner(reader, writer);
const result = await runner.run({ historyDays: 30, horizonDays: 90 });
```

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `FORECAST_HISTORY_DAYS` | No | `30` | Days of historical data used to fit the regression |
| `FORECAST_HORIZON_DAYS` | No | `90` | Days ahead to project |
| `GROWTH_SCENARIO_LOW` | No | `0.05` | Annualised growth rate for the low scenario (5%) |
| `GROWTH_SCENARIO_MEDIUM` | No | `0.15` | Annualised growth rate for the medium scenario (15%) |
| `GROWTH_SCENARIO_HIGH` | No | `0.30` | Annualised growth rate for the high scenario (30%) |

## Schema

Migration `20260428_004_create_forecast_tables` creates:

- **`forecast_results`** — one row per scenario × forecast date, grouped by `run_id`
- **`model_efficiency_snapshots`** — one row per model per snapshot run

Both tables have RLS enabled.
