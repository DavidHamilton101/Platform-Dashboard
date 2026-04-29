import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseReader } from '../storage/supabase-reader';
import { requireBearerToken } from './middleware/auth';
import { rateLimit } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { healthRouter } from './routes/health';
import { usageRouter } from './routes/usage';
import { anomaliesRouter } from './routes/anomalies';
import { forecastsRouter } from './routes/forecasts';

export function createApp(supabase: SupabaseClient): express.Application {
  const app = express();
  const reader = new SupabaseReader(supabase);

  app.use(express.json());
  app.use(rateLimit);
  app.use(requestLogger);
  app.use(requireBearerToken);

  app.use('/health', healthRouter(supabase));
  app.use('/usage', usageRouter(reader));
  app.use('/anomalies', anomaliesRouter(reader));
  app.use('/forecasts', forecastsRouter(reader));

  return app;
}
