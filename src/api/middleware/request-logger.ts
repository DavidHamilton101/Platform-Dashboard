import type { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('api:request');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    });
  });

  next();
}
