import type { SupabaseClient } from '@supabase/supabase-js';
import { StorageError } from '../utils/error-handler';
import { createModuleLogger } from '../utils/logger';
import type { UsageBucket, ParsedCostRecord, IngestionType } from '../ingestion/types';

const logger = createModuleLogger('storage:writer');

export class SupabaseWriter {
  constructor(private readonly client: SupabaseClient) {}

  async upsertUsageBuckets(buckets: UsageBucket[]): Promise<number> {
    if (buckets.length === 0) return 0;

    const rows = buckets.map(b => ({
      recorded_at: b.timestamp,
      organization_id: b.organization_id,
      workspace_id: b.workspace_id ?? 'default',
      model: b.model,
      input_tokens: b.input_tokens,
      output_tokens: b.output_tokens,
      cache_creation_input_tokens: b.cache_creation_input_tokens,
      cache_read_input_tokens: b.cache_read_input_tokens,
    }));

    const { error } = await this.client
      .from('ai_usage_daily')
      .upsert(rows, { onConflict: 'recorded_at,model,workspace_id' });

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to upsert usage buckets');
      throw new StorageError(`Failed to upsert usage buckets: ${error.message}`, { cause: error });
    }

    logger.info({ rows: rows.length }, 'Upserted usage buckets');
    return rows.length;
  }

  async upsertCostRecords(records: ParsedCostRecord[]): Promise<number> {
    if (records.length === 0) return 0;

    const rows = records.map(r => ({
      recorded_at: r.timestamp,
      organization_id: r.organization_id,
      workspace_id: r.workspace_id ?? 'default',
      model: r.model,
      cost_type: r.feature ?? 'unknown',
      amount_usd: r.amount.value,
      description: r.description,
    }));

    const { error } = await this.client
      .from('ai_cost_daily')
      .upsert(rows, { onConflict: 'recorded_at,workspace_id,model,cost_type' });

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to upsert cost records');
      throw new StorageError(`Failed to upsert cost records: ${error.message}`, { cause: error });
    }

    logger.info({ rows: rows.length }, 'Upserted cost records');
    return rows.length;
  }

  async writeIngestionLog(type: IngestionType, recordsWritten: number): Promise<void> {
    const { error } = await this.client
      .from('ingestion_log')
      .insert({
        ingestion_type: type,
        last_fetched_at: new Date().toISOString(),
        records_written: recordsWritten,
      });

    if (error) {
      logger.error({ message: error.message, code: error.code, type }, 'Failed to write ingestion log');
      throw new StorageError(`Failed to write ingestion log: ${error.message}`, { cause: error });
    }

    logger.info({ type, recordsWritten }, 'Ingestion log written');
  }
}
