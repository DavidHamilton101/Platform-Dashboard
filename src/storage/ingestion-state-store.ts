import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateEnv } from '../utils/env-validator';
import { StorageError } from '../utils/error-handler';
import { createModuleLogger } from '../utils/logger';
import type { IngestionStateStore } from '../ingestion/scheduler';
import type { IngestionType } from '../ingestion/types';

const logger = createModuleLogger('storage:ingestion-state');

export class SupabaseIngestionStateStore implements IngestionStateStore {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
    } else {
      const env = validateEnv();
      this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    }
  }

  async getLastRunAt(type: IngestionType): Promise<Date | null> {
    const { data, error } = await this.client
      .from('ingestion_log')
      .select('last_fetched_at')
      .eq('ingestion_type', type)
      .order('last_fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error({ message: error.message, code: error.code, type }, 'Failed to read ingestion state');
      throw new StorageError(`Failed to read ingestion state: ${error.message}`, { cause: error });
    }

    if (!data) return null;
    return new Date((data as { last_fetched_at: string }).last_fetched_at);
  }

  async setLastRunAt(type: IngestionType, timestamp: Date): Promise<void> {
    const { error } = await this.client
      .from('ingestion_log')
      .insert({
        ingestion_type: type,
        last_fetched_at: timestamp.toISOString(),
        records_written: 0,
      });

    if (error) {
      logger.error({ message: error.message, code: error.code, type }, 'Failed to write ingestion state');
      throw new StorageError(`Failed to write ingestion state: ${error.message}`, { cause: error });
    }

    logger.info({ type, timestamp }, 'Ingestion state updated');
  }
}
