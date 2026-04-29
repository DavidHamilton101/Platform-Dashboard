import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createModuleLogger } from '../../utils/logger';

const logger = createModuleLogger('api:health');

export function healthRouter(supabase: SupabaseClient): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    let supabaseStatus: 'connected' | 'error' = 'connected';

    try {
      const { error } = await supabase.from('ingestion_log').select('id').limit(1);
      if (error) supabaseStatus = 'error';
    } catch (err) {
      logger.error({ err }, 'Supabase connectivity check failed');
      supabaseStatus = 'error';
    }

    res.json({
      status: 'ok',
      supabase: supabaseStatus,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
