import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit, _resetRateLimitWindows } from '../../../src/api/middleware/rate-limit';
import type { Request, Response, NextFunction } from 'express';

// AC2: Rate limiting enforced at 60 requests per minute per IP. Requests exceeding the limit return 429.

function makeReqResNext(ip = '127.0.0.1'): {
  req: Request;
  res: Response;
  next: NextFunction;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const req = {
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;
  const res = { status, json } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status, json };
}

function sendRequests(count: number, ip = '127.0.0.1'): { nexts: number; blocked: number } {
  let nexts = 0;
  let blocked = 0;
  for (let i = 0; i < count; i++) {
    const { req, res, next } = makeReqResNext(ip);
    rateLimit(req, res, next);
    if ((next as ReturnType<typeof vi.fn>).mock.calls.length > 0) nexts++;
    else blocked++;
  }
  return { nexts, blocked };
}

describe('rateLimit — AC2', () => {
  beforeEach(() => {
    _resetRateLimitWindows();
  });

  it('allows exactly 60 requests within the window', () => {
    const { nexts, blocked } = sendRequests(60);
    expect(nexts).toBe(60);
    expect(blocked).toBe(0);
  });

  it('returns 429 on the 61st request within the same window', () => {
    sendRequests(60);
    const { req, res, next, status, json } = makeReqResNext();
    rateLimit(req, res, next);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ error: 'Too Many Requests' });
    expect(next).not.toHaveBeenCalled();
  });

  it('tracks IPs independently — different IPs do not share a window', () => {
    sendRequests(60, '10.0.0.1');
    // Different IP should still have its full 60 requests available
    const { nexts } = sendRequests(60, '10.0.0.2');
    expect(nexts).toBe(60);
  });

  it('resets counter when window expires', () => {
    vi.useFakeTimers();

    sendRequests(60);

    // Advance time past the 60-second window
    vi.advanceTimersByTime(61_000);

    const { req, res, next } = makeReqResNext();
    rateLimit(req, res, next);
    expect(next).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('allows requests up to but not including the limit', () => {
    sendRequests(59);
    const { req, res, next, status } = makeReqResNext();
    rateLimit(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });
});
