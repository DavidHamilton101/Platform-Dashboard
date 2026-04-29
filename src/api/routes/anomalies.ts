import { Router } from 'express';
import type { SupabaseReader } from '../../storage/supabase-reader';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('api:anomalies');

export function anomaliesRouter(reader: SupabaseReader): Router {
  const router = Router();

  router.get('/recent', async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    try {
      const data = await reader.getAlertLog(limit);
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get recent alerts');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/log', async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    try {
      const data = await reader.getAlertLog(limit);
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get alert log');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
