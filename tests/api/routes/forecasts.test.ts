import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { _resetRateLimitWindows } from '../../../src/api/middleware/rate-limit';
import { requireBearerToken } from '../../../src/api/middleware/auth';
import { rateLimit } from '../../../src/api/middleware/rate-limit';
import { requestLogger } from '../../../src/api/middleware/request-logger';
import { forecastsRouter } from '../../../src/api/routes/forecasts';
import type { SupabaseReader, ForecastResultRow, ModelEfficiencySnapshotRow } from '../../../src/storage/supabase-reader';

// AC6: Forecast endpoints return latest forecast results and model efficiency snapshots.

const API_KEY = 'test-forecast-key';

const FORECAST_ROWS: ForecastResultRow[] = [
  {
    run_id: 'run-abc-123',
    generated_at: '2026-04-28T12:00:00Z',
    horizon_days: 90,
    scenario: 'medium',
    forecast_date: '2026-05-01',
    predicted_cost_usd: 1.25,
  },
];

const EFFICIENCY_ROWS: ModelEfficiencySnapshotRow[] = [
  {
    model: 'claude-3-5-sonnet-20241022',
    cost_per_million_tokens: 3.0,
    total_cost_usd: 45.00,
    total_tokens: 15_000_000,
    analysis_days: 30,
    snapshot_at: '2026-04-28T12:00:00Z',
  },
];

function makeReader(overrides: Partial<SupabaseReader> = {}): SupabaseReader {
  return {
    getLatestForecastRun: vi.fn().mockResolvedValue(FORECAST_ROWS),
    getLatestModelEfficiency: vi.fn().mockResolvedValue(EFFICIENCY_ROWS),
    ...overrides,
  } as unknown as SupabaseReader;
}

function makeApp(reader: SupabaseReader) {
  const app = express();
  app.use(express.json());
  app.use(rateLimit);
  app.use(requestLogger);
  app.use(requireBearerToken);
  app.use('/forecasts', forecastsRouter(reader));
  return app;
}

describe('Forecast endpoints — AC6', () => {
  const ORIGINAL_KEY = process.env.DASHBOARD_API_KEY;

  beforeEach(() => {
    process.env.DASHBOARD_API_KEY = API_KEY;
    _resetRateLimitWindows();
  });

  afterEach(() => {
    process.env.DASHBOARD_API_KEY = ORIGINAL_KEY;
  });

  it('GET /forecasts/latest returns forecast results', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/forecasts/latest').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].run_id).toBe('run-abc-123');
    expect(res.body.data[0].scenario).toBe('medium');
  });

  it('GET /forecasts/efficiency returns model efficiency snapshots', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/forecasts/efficiency').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].model).toBe('claude-3-5-sonnet-20241022');
    expect(res.body.data[0].cost_per_million_tokens).toBe(3.0);
  });

  it('GET /forecasts/latest returns 401 without auth', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/forecasts/latest');
    expect(res.status).toBe(401);
  });

  it('GET /forecasts/efficiency returns 401 without auth', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/forecasts/efficiency');
    expect(res.status).toBe(401);
  });

  it('GET /forecasts/latest returns empty array when no forecasts exist', async () => {
    const reader = makeReader({ getLatestForecastRun: vi.fn().mockResolvedValue([]) });
    const app = makeApp(reader);
    const res = await request(app).get('/forecasts/latest').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 500 when forecast reader throws', async () => {
    const reader = makeReader({ getLatestForecastRun: vi.fn().mockRejectedValue(new Error('db error')) });
    const app = makeApp(reader);
    const res = await request(app).get('/forecasts/latest').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(500);
  });

  it('returns 500 when efficiency reader throws', async () => {
    const reader = makeReader({ getLatestModelEfficiency: vi.fn().mockRejectedValue(new Error('db error')) });
    const app = makeApp(reader);
    const res = await request(app).get('/forecasts/efficiency').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(500);
  });
});
