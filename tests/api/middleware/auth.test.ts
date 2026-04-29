import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { requireBearerToken } from '../../../src/api/middleware/auth';
import type { Request, Response, NextFunction } from 'express';

// AC1: All endpoints require valid bearer token authentication via DASHBOARD_API_KEY env var.
//      Unauthenticated requests return 401.

function makeReqResNext(authHeader?: string): {
  req: Request;
  res: Response;
  next: NextFunction;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const req = { headers: authHeader ? { authorization: authHeader } : {} } as unknown as Request;
  const res = { status, json } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status, json };
}

describe('requireBearerToken — AC1', () => {
  const ORIGINAL_KEY = process.env.DASHBOARD_API_KEY;

  beforeEach(() => {
    process.env.DASHBOARD_API_KEY = 'test-secret-key';
  });

  afterEach(() => {
    process.env.DASHBOARD_API_KEY = ORIGINAL_KEY;
  });

  it('returns 401 when Authorization header is absent', () => {
    const { req, res, next, status, json } = makeReqResNext();
    requireBearerToken(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is not a Bearer token', () => {
    const { req, res, next, status } = makeReqResNext('Basic dXNlcjpwYXNz');
    requireBearerToken(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token does not match DASHBOARD_API_KEY', () => {
    const { req, res, next, status } = makeReqResNext('Bearer wrong-key');
    requireBearerToken(req, res, next);
    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when Bearer token matches DASHBOARD_API_KEY', () => {
    const { req, res, next, status } = makeReqResNext('Bearer test-secret-key');
    requireBearerToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('returns 500 when DASHBOARD_API_KEY is not configured', () => {
    delete process.env.DASHBOARD_API_KEY;
    const { req, res, next, status } = makeReqResNext('Bearer anything');
    requireBearerToken(req, res, next);
    expect(status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
