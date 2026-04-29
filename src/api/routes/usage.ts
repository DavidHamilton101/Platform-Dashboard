import { Router } from 'express';
import type { SupabaseReader } from '../../storage/supabase-reader';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('api:usage');

export function usageRouter(reader: SupabaseReader): Router {
  const router = Router();

  router.get('/summary', async (req, res) => {
    const days = Number(req.query.days ?? 30);
    try {
      const data = await reader.getUsageSummary(days);
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get usage summary');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/daily', async (req, res) => {
    const days = Number(req.query.days ?? 30);
    try {
      const data = await reader.getDailyUsage(days);
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get daily usage');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/costs', async (req, res) => {
    const days = Number(req.query.days ?? 30);
    try {
      const data = await reader.getDailyCostSeries(days);
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get daily cost series');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/costs/workspace', async (req, res) => {
    const days = Number(req.query.days ?? 30);
    try {
      const data = await reader.getCostByWorkspace(days);
      res.json({ data });
    } catch (err) {
      logger.error({ err }, 'Failed to get cost by workspace');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
