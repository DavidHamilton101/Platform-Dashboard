import { Router } from 'express';
import type { SupabaseReader } from '../../storage/supabase-reader';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('api:forecasts');

export function forecastsRouter(reader: SupabaseReader): Router {
  const router = Router();

  router.get('/latest', async (_req, res) => {
    try {
      const data = await reader.getLatestForecastRun();
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get latest forecast');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/efficiency', async (_req, res) => {
    try {
      const data = await reader.getLatestModelEfficiency();
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get model efficiency');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
