import type { SupabaseClient } from '@supabase/supabase-js';
import { StorageError } from '../utils/error-handler';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('storage:reader');

export interface UsageSummaryRow {
  model: string;
  workspace_id: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
}

export interface DailyUsageRow {
  recorded_at: string;
  model: string;
  workspace_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface LastIngestionRow {
  ingestion_type: string;
  last_fetched_at: string;
  records_written: number;
}

export interface CostByWorkspaceRow {
  workspace_id: string;
  model: string | null;
  cost_type: string;
  total_amount_usd: number;
}

export interface DailyCostSeriesRow {
  day: string; // 'YYYY-MM-DD'
  total_amount_usd: number;
}

export class SupabaseReader {
  constructor(private readonly client: SupabaseClient) {}

  async getUsageSummary(days: number): Promise<UsageSummaryRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString();

    const { data, error } = await this.client
      .from('ai_usage_daily')
      .select('model, workspace_id, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens')
      .gte('recorded_at', since);

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query usage summary');
      throw new StorageError(`Failed to query usage summary: ${error.message}`, { cause: error });
    }

    const totals = new Map<string, UsageSummaryRow>();
    for (const row of data ?? []) {
      const key = `${row.model}:${row.workspace_id}`;
      const existing = totals.get(key) ?? {
        model: row.model,
        workspace_id: row.workspace_id,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cache_creation_tokens: 0,
        total_cache_read_tokens: 0,
      };
      existing.total_input_tokens += row.input_tokens;
      existing.total_output_tokens += row.output_tokens;
      existing.total_cache_creation_tokens += row.cache_creation_input_tokens;
      existing.total_cache_read_tokens += row.cache_read_input_tokens;
      totals.set(key, existing);
    }

    return Array.from(totals.values());
  }

  async getDailyUsage(days: number): Promise<DailyUsageRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString();

    const { data, error } = await this.client
      .from('ai_usage_daily')
      .select('recorded_at, model, workspace_id, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query daily usage');
      throw new StorageError(`Failed to query daily usage: ${error.message}`, { cause: error });
    }

    return (data ?? []) as DailyUsageRow[];
  }

  async getLastIngestion(): Promise<LastIngestionRow | null> {
    const { data, error } = await this.client
      .from('ingestion_log')
      .select('ingestion_type, last_fetched_at, records_written')
      .order('last_fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query ingestion log');
      throw new StorageError(`Failed to query ingestion log: ${error.message}`, { cause: error });
    }

    return data as LastIngestionRow | null;
  }

  async getDailyCostSeries(days: number): Promise<DailyCostSeriesRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString();

    const { data, error } = await this.client
      .from('ai_cost_daily')
      .select('recorded_at, amount_usd')
      .gte('recorded_at', since);

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query daily cost series');
      throw new StorageError(`Failed to query daily cost series: ${error.message}`, { cause: error });
    }

    const byDay = new Map<string, number>();
    for (const row of data ?? []) {
      const day = (row.recorded_at as string).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(row.amount_usd));
    }

    return Array.from(byDay.entries())
      .map(([day, total_amount_usd]) => ({ day, total_amount_usd }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }

  async getCostByWorkspace(days: number): Promise<CostByWorkspaceRow[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString();

    const { data, error } = await this.client
      .from('ai_cost_daily')
      .select('workspace_id, model, cost_type, amount_usd')
      .gte('recorded_at', since);

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query cost by workspace');
      throw new StorageError(`Failed to query cost by workspace: ${error.message}`, { cause: error });
    }

    const totals = new Map<string, CostByWorkspaceRow>();
    for (const row of data ?? []) {
      const key = `${row.workspace_id}:${row.model ?? 'null'}:${row.cost_type}`;
      const existing = totals.get(key) ?? {
        workspace_id: row.workspace_id,
        model: row.model as string | null,
        cost_type: row.cost_type,
        total_amount_usd: 0,
      };
      existing.total_amount_usd += Number(row.amount_usd);
      totals.set(key, existing);
    }

    return Array.from(totals.values());
  }
}
