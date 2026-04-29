import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { _resetRateLimitWindows } from '../../../src/api/middleware/rate-limit';
import { requireBearerToken } from '../../../src/api/middleware/auth';
import { rateLimit } from '../../../src/api/middleware/rate-limit';
import { requestLogger } from '../../../src/api/middleware/request-logger';
import { anomaliesRouter } from '../../../src/api/routes/anomalies';
import type { SupabaseReader, AlertLogRow } from '../../../src/storage/supabase-reader';

// AC5: Anomaly endpoints return recent alerts and alert log.

const API_KEY = 'test-anomaly-key';

const ALERT_ROWS: AlertLogRow[] = [
  {
    id: 'abc-123',
    anomaly_type: 'token_spike',
    severity: 'critical',
    message: 'Token spike detected',
    metadata: { model: 'claude-3-5-sonnet-20241022' },
    fired_at: '2026-04-28T12:00:00Z',
    acknowledged_at: null,
  },
];

function makeReader(overrides: Partial<SupabaseReader> = {}): SupabaseReader {
  return {
    getAlertLog: vi.fn().mockResolvedValue(ALERT_ROWS),
    ...overrides,
  } as unknown as SupabaseReader;
}

function makeApp(reader: SupabaseReader) {
  const app = express();
  app.use(express.json());
  app.use(rateLimit);
  app.use(requestLogger);
  app.use(requireBearerToken);
  app.use('/anomalies', anomaliesRouter(reader));
  return app;
}

describe('Anomaly endpoints — AC5', () => {
  const ORIGINAL_KEY = process.env.DASHBOARD_API_KEY;

  beforeEach(() => {
    process.env.DASHBOARD_API_KEY = API_KEY;
    _resetRateLimitWindows();
  });

  afterEach(() => {
    process.env.DASHBOARD_API_KEY = ORIGINAL_KEY;
  });

  it('GET /anomalies/recent returns recent alert data', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/anomalies/recent').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].anomaly_type).toBe('token_spike');
  });

  it('GET /anomalies/log returns alert log data', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/anomalies/log').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].severity).toBe('critical');
  });

  it('GET /anomalies/recent returns 401 without auth', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/anomalies/recent');
    expect(res.status).toBe(401);
  });

  it('GET /anomalies/log returns 401 without auth', async () => {
    const app = makeApp(makeReader());
    const res = await request(app).get('/anomalies/log');
    expect(res.status).toBe(401);
  });

  it('GET /anomalies/recent defaults to limit 20', async () => {
    const reader = makeReader();
    const app = makeApp(reader);
    await request(app).get('/anomalies/recent').set('Authorization', `Bearer ${API_KEY}`);
    expect(reader.getAlertLog).toHaveBeenCalledWith(20);
  });

  it('GET /anomalies/log defaults to limit 100', async () => {
    const reader = makeReader();
    const app = makeApp(reader);
    await request(app).get('/anomalies/log').set('Authorization', `Bearer ${API_KEY}`);
    expect(reader.getAlertLog).toHaveBeenCalledWith(100);
  });

  it('caps /anomalies/recent limit at 100', async () => {
    const reader = makeReader();
    const app = makeApp(reader);
    await request(app).get('/anomalies/recent?limit=999').set('Authorization', `Bearer ${API_KEY}`);
    expect(reader.getAlertLog).toHaveBeenCalledWith(100);
  });

  it('returns 500 when reader throws', async () => {
    const reader = makeReader({ getAlertLog: vi.fn().mockRejectedValue(new Error('db error')) });
    const app = makeApp(reader);
    const res = await request(app).get('/anomalies/recent').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(500);
  });
});
