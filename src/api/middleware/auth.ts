import type { Request, Response, NextFunction } from 'express';

export function requireBearerToken(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.DASHBOARD_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfiguration: DASHBOARD_API_KEY not set' });
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);

  if (token !== apiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
