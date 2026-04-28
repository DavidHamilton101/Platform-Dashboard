import { describe, it, expect, vi } from 'vitest';
import { TeamsAlerter } from '../../src/anomaly/teams-alerter';
import { AlertError } from '../../src/utils/error-handler';
import type { AnomalyResult } from '../../src/anomaly/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAnomaly(overrides: Partial<AnomalyResult> = {}): AnomalyResult {
  return {
    type: 'token_spike',
    severity: 'warning',
    message: 'Token spike detected: test',
    metadata: { today: '2026-04-28', todayTokens: 900_000 },
    detectedAt: '2026-04-28T12:00:00Z',
    ...overrides,
  };
}

function mockFetch(status: number, ok: boolean): typeof fetch {
  return vi.fn().mockResolvedValue({ ok, status } as Response);
}

function failingFetch(error: Error): typeof fetch {
  return vi.fn().mockRejectedValue(error);
}

// ─── TeamsAlerter.send ────────────────────────────────────────────────────────

describe('TeamsAlerter.send', () => {
  it('posts JSON to the webhook URL', async () => {
    const fetchFn = mockFetch(200, true);
    const alerter = new TeamsAlerter('https://example.webhook/url', fetchFn);

    await alerter.send(makeAnomaly());

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.webhook/url');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('serialises a valid JSON body with @type MessageCard', async () => {
    const fetchFn = mockFetch(200, true);
    const alerter = new TeamsAlerter('https://example.webhook/url', fetchFn);

    await alerter.send(makeAnomaly());

    const body = JSON.parse(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    ) as Record<string, unknown>;
    expect(body['@type']).toBe('MessageCard');
  });

  it('uses red themeColor for critical severity', async () => {
    const fetchFn = mockFetch(200, true);
    const alerter = new TeamsAlerter('https://example.webhook/url', fetchFn);

    await alerter.send(makeAnomaly({ severity: 'critical' }));

    const body = JSON.parse(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    ) as Record<string, unknown>;
    expect(body.themeColor).toBe('FF0000');
  });

  it('uses orange themeColor for warning severity', async () => {
    const fetchFn = mockFetch(200, true);
    const alerter = new TeamsAlerter('https://example.webhook/url', fetchFn);

    await alerter.send(makeAnomaly({ severity: 'warning' }));

    const body = JSON.parse(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    ) as Record<string, unknown>;
    expect(body.themeColor).toBe('FFA500');
  });

  it('throws AlertError on non-OK HTTP response', async () => {
    const alerter = new TeamsAlerter('https://example.webhook/url', mockFetch(400, false));
    await expect(alerter.send(makeAnomaly())).rejects.toBeInstanceOf(AlertError);
  });

  it('throws AlertError when fetch throws a network error', async () => {
    const alerter = new TeamsAlerter(
      'https://example.webhook/url',
      failingFetch(new Error('network failure'))
    );
    await expect(alerter.send(makeAnomaly())).rejects.toBeInstanceOf(AlertError);
  });

  it('includes anomaly message in the card sections', async () => {
    const fetchFn = mockFetch(200, true);
    const alerter = new TeamsAlerter('https://example.webhook/url', fetchFn);
    const anomaly = makeAnomaly({ message: 'Specific spike message for test' });

    await alerter.send(anomaly);

    const body = JSON.parse(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    ) as { sections: Array<{ activityText: string }> };
    expect(body.sections[0].activityText).toBe('Specific spike message for test');
  });

  it('serialises metadata as facts array', async () => {
    const fetchFn = mockFetch(200, true);
    const alerter = new TeamsAlerter('https://example.webhook/url', fetchFn);

    await alerter.send(makeAnomaly({ metadata: { foo: 'bar', count: 42 } }));

    const body = JSON.parse(
      (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string
    ) as { sections: Array<{ facts: Array<{ name: string; value: string }> }> };
    expect(body.sections[0].facts).toContainEqual({ name: 'foo', value: 'bar' });
    expect(body.sections[0].facts).toContainEqual({ name: 'count', value: '42' });
  });
});
