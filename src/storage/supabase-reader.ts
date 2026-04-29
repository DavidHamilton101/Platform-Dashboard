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

export interface AlertLogRow {
  id: string;
  anomaly_type: string;
  severity: string;
  message: string;
  metadata: Record<string, unknown>;
  fired_at: string;
  acknowledged_at: string | null;
}

export interface ForecastResultRow {
  run_id: string;
  generated_at: string;
  horizon_days: number;
  scenario: string;
  forecast_date: string;
  predicted_cost_usd: number;
}

export interface ModelEfficiencySnapshotRow {
  model: string;
  cost_per_million_tokens: number;
  total_cost_usd: number;
  total_tokens: number;
  analysis_days: number;
  snapshot_at: string;
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

  async getAlertLog(limit: number): Promise<AlertLogRow[]> {
    const { data, error } = await this.client
      .from('alert_log')
      .select('id, anomaly_type, severity, message, metadata, fired_at, acknowledged_at')
      .order('fired_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query alert log');
      throw new StorageError(`Failed to query alert log: ${error.message}`, { cause: error });
    }

    return (data ?? []) as AlertLogRow[];
  }

  async getLatestForecastRun(): Promise<ForecastResultRow[]> {
    const { data: latest, error: latestError } = await this.client
      .from('forecast_results')
      .select('run_id')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      logger.error({ message: latestError.message, code: latestError.code }, 'Failed to query latest forecast run_id');
      throw new StorageError(`Failed to query latest forecast: ${latestError.message}`, { cause: latestError });
    }

    if (!latest) return [];

    const { data, error } = await this.client
      .from('forecast_results')
      .select('run_id, generated_at, horizon_days, scenario, forecast_date, predicted_cost_usd')
      .eq('run_id', latest.run_id)
      .order('scenario', { ascending: true })
      .order('forecast_date', { ascending: true });

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query forecast results');
      throw new StorageError(`Failed to query forecast results: ${error.message}`, { cause: error });
    }

    return (data ?? []) as ForecastResultRow[];
  }

  async getLatestModelEfficiency(): Promise<ModelEfficiencySnapshotRow[]> {
    const { data: latest, error: latestError } = await this.client
      .from('model_efficiency_snapshots')
      .select('snapshot_at')
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      logger.error({ message: latestError.message, code: latestError.code }, 'Failed to query latest snapshot timestamp');
      throw new StorageError(`Failed to query model efficiency: ${latestError.message}`, { cause: latestError });
    }

    if (!latest) return [];

    const { data, error } = await this.client
      .from('model_efficiency_snapshots')
      .select('model, cost_per_million_tokens, total_cost_usd, total_tokens, analysis_days, snapshot_at')
      .eq('snapshot_at', latest.snapshot_at);

    if (error) {
      logger.error({ message: error.message, code: error.code }, 'Failed to query model efficiency snapshots');
      throw new StorageError(`Failed to query model efficiency snapshots: ${error.message}`, { cause: error });
    }

    return (data ?? []) as ModelEfficiencySnapshotRow[];
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
