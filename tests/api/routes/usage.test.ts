import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { _resetRateLimitWindows } from '../../../src/api/middleware/rate-limit';
import { requireBearerToken } from '../../../src/api/middleware/auth';
import { rateLimit } from '../../../src/api/middleware/rate-limit';
import { requestLogger } from '../../../src/api/middleware/request-logger';
import { usageRouter } from '../../../src/api/routes/usage';
import type { SupabaseReader } from '../../../src/storage/supabase-reader';

// AC4: Usage endpoints return ingested token and cost data from the storage layer.

const API_KEY = 'test-usage-key';

const USAGE_SUMMARY = [
  { model: 'claude-3-5-sonnet-20241022', workspace_id: 'ws-1', total_input_tokens: 1000, total_output_tokens: 500, total_cache_creation_tokens: 0, total_cache_read_tokens: 0 },
];
const DAILY_USAGE = [
  { recorded_at: '2026-04-28T00:00:00Z', model: 'claude-3-5-sonnet-20241022', workspace_id: 'ws-1', input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
];
const DAILY_COSTS = [{ day: '2026-04-28', total_amount_usd: 0.05 }];
const COST_BY_WORKSPACE = [{ workspace_id: 'ws-1', model: 'claude-3-5-sonnet-20241022', cost_type: 'inference', total_amount_usd: 0.05 }];

function makeReader(overrides: Partial<SupabaseReader> = {}): SupabaseReader {
  return {
    getUsageSummary: vi.fn().mockResolvedValue(USAGE_SUMMARY),
    getDailyUsage: vi.fn().mockResolvedValue(DAILY_USAGE),
    getDailyCostSeries: vi.fn().mockResolvedValue(DAILY_COSTS),
    getCostByWorkspace: vi.fn().mockResolvedValue(COST_BY_WORKSPACE),
    ...overrides,
  } as unknown as SupabaseReader;
}

function makeApp(reader: SupabaseReader) {
  const app = express();
  app.use(express.json());
  app.use(rateLimit);
  app.use(requestLogger);
  app.use(requireBearerToken);
  app.use('/usage', usageRouter(reader));
  return app;
}

describe('Usage endpoints — AC4', () => {
  const ORIGINAL_KEY = process.env.DASHBOARD_API_KEY;

  beforeEach(() => {
    process.env.DASHBOARD_API_KEY = API_KEY;
    _resetRateLimitWindows();
  });

  afterEach(() => {
    process.env.DASHBOARD_API_KEY = ORIGINAL_KEY;
  });

  it('GET /usage/summary returns usage summary data', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/usage/summary').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].model).toBe('claude-3-5-sonnet-20241022');
  });

  it('GET /usage/daily returns daily usage data', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/usage/daily').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data[0].input_tokens).toBe(1000);
  });

  it('GET /usage/costs returns daily cost series', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/usage/costs').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].day).toBe('2026-04-28');
  });

  it('GET /usage/costs/workspace returns cost by workspace', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/usage/costs/workspace').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].workspace_id).toBe('ws-1');
  });

  it('GET /usage/summary returns 401 without auth', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/usage/summary');
    expect(res.status).toBe(401);
  });

  it('passes days query param to reader', async () => {
    const reader = makeReader();
    const app = makeApp(reader);
    await request(app).get('/usage/summary?days=7').set('Authorization', `Bearer ${API_KEY}`);
    expect(reader.getUsageSummary).toHaveBeenCalledWith(7);
  });

  it('returns 500 when reader throws', async () => {
    const reader = makeReader({ getUsageSummary: vi.fn().mockRejectedValue(new Error('db error')) });
    const app = makeApp(reader);
    const res = await request(app).get('/usage/summary').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(500);
  });
});
