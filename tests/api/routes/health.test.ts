import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/api/index';
import { _resetRateLimitWindows } from '../../../src/api/middleware/rate-limit';
import type { SupabaseClient } from '@supabase/supabase-js';

// AC1: Unauthenticated requests return 401.
// AC3: GET /health returns service status and Supabase connectivity confirmation.

const API_KEY = 'test-health-key';

function makeSupabase(supabaseOk = true): SupabaseClient {
  const selectResult = supabaseOk
    ? { data: [], error: null }
    : { data: null, error: { message: 'connection refused', code: '500' } };

  return {
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve(selectResult),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('GET /health — AC1 + AC3', () => {
  const ORIGINAL_KEY = process.env.DASHBOARD_API_KEY;

  beforeEach(() => {
    process.env.DASHBOARD_API_KEY = API_KEY;
    _resetRateLimitWindows();
  });

  afterEach(() => {
    process.env.DASHBOARD_API_KEY = ORIGINAL_KEY;
  });

  it('returns 401 when no auth header is provided', async () => {
    const app = createApp(makeSupabase());
    const res = await request(app).get('/health');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is wrong', async () => {
    const app = createApp(makeSupabase());
    const res = await request(app).get('/health').set('Authorization', 'Bearer wrong');
    expect(res.status).toBe(401);
  });

  it('returns 200 with status, supabase, and timestamp when Supabase is connected', async () => {
    const app = createApp(makeSupabase(true));
    const res = await request(app).get('/health').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.supabase).toBe('connected');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('returns supabase: error when Supabase is unreachable', async () => {
    const app = createApp(makeSupabase(false));
    const res = await request(app).get('/health').set('Authorization', `Bearer ${API_KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.supabase).toBe('error');
  });

  it('timestamp in response is a valid ISO string', async () => {
    const app = createApp(makeSupabase());
    const res = await request(app).get('/health').set('Authorization', `Bearer ${API_KEY}`);
    expect(() => new Date(res.body.timestamp)).not.toThrow();
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});
