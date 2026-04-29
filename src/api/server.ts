import { createClient } from '@supabase/supabase-js';
import { validateEnv } from '../utils/env-validator';
import { createApp } from './index';
import { logger } from '../utils/logger';

const env = validateEnv();
const PORT = Number(process.env.API_PORT ?? 3000);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const app = createApp(supabase);

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Dashboard API server started');
});
