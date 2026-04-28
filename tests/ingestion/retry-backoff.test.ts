import { describe, it, expect, vi, beforeEach } from 'vitest';
import { anthropicFetch } from '../../src/ingestion/http-client';
import { ApiError } from '../../src/utils/error-handler';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const noSleep = vi.fn().mockResolvedValue(undefined);

const okResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

const errResponse = (status: number) => ({
  ok: false,
  status,
  json: async () => ({}),
});

describe('anthropicFetch — retry and exponential backoff', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    noSleep.mockClear();
  });

  it('returns parsed JSON on first successful attempt', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ data: [] }));

    const result = await anthropicFetch('/v1/test', 'key', {}, { sleepFn: noSleep });

    expect(result).toEqual({ data: [] });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it('retries on 429 and succeeds on the second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce(errResponse(429))
      .mockResolvedValueOnce(okResponse({ data: ['ok'] }));

    const result = await anthropicFetch('/v1/test', 'key', {}, { maxRetries: 3, sleepFn: noSleep });

    expect(result).toEqual({ data: ['ok'] });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(noSleep).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 and succeeds on the second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce(errResponse(500))
      .mockResolvedValueOnce(okResponse({}));

    await anthropicFetch('/v1/test', 'key', {}, { maxRetries: 3, sleepFn: noSleep });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 and succeeds on the second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse({}));

    await anthropicFetch('/v1/test', 'key', {}, { maxRetries: 3, sleepFn: noSleep });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws ApiError after exhausting retries on 429', async () => {
    mockFetch.mockResolvedValue(errResponse(429));

    await expect(
      anthropicFetch('/v1/test', 'key', {}, { maxRetries: 2, sleepFn: noSleep })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('throws ApiError after exhausting retries on 500', async () => {
    mockFetch.mockResolvedValue(errResponse(500));

    await expect(
      anthropicFetch('/v1/test', 'key', {}, { maxRetries: 1, sleepFn: noSleep })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('applies exponential backoff: delay doubles on each retry', async () => {
    mockFetch
      .mockResolvedValueOnce(errResponse(500))
      .mockResolvedValueOnce(errResponse(500))
      .mockResolvedValueOnce(okResponse({}));

    await anthropicFetch('/v1/test', 'key', {}, {
      maxRetries: 3,
      baseDelayMs: 100,
      sleepFn: noSleep,
    });

    expect(noSleep).toHaveBeenNthCalledWith(1, 100); // 100 * 2^0
    expect(noSleep).toHaveBeenNthCalledWith(2, 200); // 100 * 2^1
  });

  it('does NOT retry on 400', async () => {
    mockFetch.mockResolvedValueOnce(errResponse(400));

    await expect(
      anthropicFetch('/v1/test', 'key', {}, { sleepFn: noSleep })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(noSleep).not.toHaveBeenCalled();
  });

  it('does NOT retry on 401', async () => {
    mockFetch.mockResolvedValueOnce(errResponse(401));

    await expect(
      anthropicFetch('/v1/test', 'key', {}, { sleepFn: noSleep })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 403', async () => {
    mockFetch.mockResolvedValueOnce(errResponse(403));

    await expect(
      anthropicFetch('/v1/test', 'key', {}, { sleepFn: noSleep })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on network error and throws ApiError after exhaustion', async () => {
    mockFetch.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      anthropicFetch('/v1/test', 'key', {}, { maxRetries: 2, sleepFn: noSleep })
    ).rejects.toBeInstanceOf(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('includes the original error as cause on network failure', async () => {
    const networkErr = new TypeError('fetch failed');
    mockFetch.mockRejectedValue(networkErr);

    const err = await anthropicFetch('/v1/test', 'key', {}, { maxRetries: 0, sleepFn: noSleep })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).cause).toBe(networkErr);
  });
});
