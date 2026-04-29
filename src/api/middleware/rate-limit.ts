import type { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

interface WindowEntry {
  count: number;
  windowStart: number;
}

const ipWindows = new Map<string, WindowEntry>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();

  const entry = ipWindows.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    ipWindows.set(ip, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    res.status(429).json({ error: 'Too Many Requests' });
    return;
  }

  entry.count++;
  next();
}

export function _resetRateLimitWindows(): void {
  ipWindows.clear();
}
