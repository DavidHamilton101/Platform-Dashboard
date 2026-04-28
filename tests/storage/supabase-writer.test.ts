import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseWriter } from '../../src/storage/supabase-writer';
import { StorageError } from '../../src/utils/error-handler';
import type { UsageBucket, ParsedCostRecord } from '../../src/ingestion/types';

// ─── Mock client helpers ──────────────────────────────────────────────────────

function makeUpsertClient(result: { error: object | null }): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue(result) }),
  } as unknown as SupabaseClient;
}

function makeInsertClient(result: { error: object | null }): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue(result) }),
  } as unknown as SupabaseClient;
}

// ─── Test data ────────────────────────────────────────────────────────────────

const bucket = (overrides: Partial<UsageBucket> = {}): UsageBucket => ({
  timestamp: '2026-04-01T00:00:00Z',
  organization_id: 'org-1',
  workspace_id: 'ws-1',
  model: 'claude-3-5-sonnet-20241022',
  input_tokens: 1_000,
  output_tokens: 500,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  ...overrides,
});

const costRecord = (overrides: Partial<ParsedCostRecord> = {}): ParsedCostRecord => ({
  timestamp: '2026-04-01T00:00:00Z',
  organization_id: 'org-1',
  workspace_id: 'ws-1',
  description: 'claude-3-5-sonnet-20241022 input',
  amount: { value: 12.5, currency: 'USD' },
  model: 'claude-3-5-sonnet-20241022',
  feature: 'input',
  ...overrides,
});

// ─── upsertUsageBuckets ───────────────────────────────────────────────────────

describe('SupabaseWriter.upsertUsageBuckets', () => {
  it('returns 0 and skips the DB call for an empty array', async () => {
    const client = makeUpsertClient({ error: null });
    const writer = new SupabaseWriter(client);

    const count = await writer.upsertUsageBuckets([]);

    expect(count).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('upserts rows and returns the submitted count', async () => {
    const client = makeUpsertClient({ error: null });
    const writer = new SupabaseWriter(client);

    const count = await writer.upsertUsageBuckets([bucket(), bucket()]);

    expect(count).toBe(2);
    expect(client.from).toHaveBeenCalledWith('ai_usage_daily');
  });

  it('maps null workspace_id to "default"', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    await writer.upsertUsageBuckets([bucket({ workspace_id: null })]);

    const rows = mockUpsert.mock.calls[0][0] as Array<{ workspace_id: string }>;
    expect(rows[0].workspace_id).toBe('default');
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeUpsertClient({ error: { message: 'db failure', code: '500' } });
    const writer = new SupabaseWriter(client);

    await expect(writer.upsertUsageBuckets([bucket()])).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── upsertCostRecords ────────────────────────────────────────────────────────

describe('SupabaseWriter.upsertCostRecords', () => {
  it('returns 0 and skips the DB call for an empty array', async () => {
    const client = makeUpsertClient({ error: null });
    const writer = new SupabaseWriter(client);

    const count = await writer.upsertCostRecords([]);

    expect(count).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('upserts rows and returns the submitted count', async () => {
    const client = makeUpsertClient({ error: null });
    const writer = new SupabaseWriter(client);

    const count = await writer.upsertCostRecords([costRecord(), costRecord()]);

    expect(count).toBe(2);
    expect(client.from).toHaveBeenCalledWith('ai_cost_daily');
  });

  it('maps null workspace_id to "default"', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    await writer.upsertCostRecords([costRecord({ workspace_id: null })]);

    const rows = mockUpsert.mock.calls[0][0] as Array<{ workspace_id: string }>;
    expect(rows[0].workspace_id).toBe('default');
  });

  it('maps null feature to "unknown" cost_type', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    await writer.upsertCostRecords([costRecord({ feature: null })]);

    const rows = mockUpsert.mock.calls[0][0] as Array<{ cost_type: string }>;
    expect(rows[0].cost_type).toBe('unknown');
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeUpsertClient({ error: { message: 'constraint violation', code: '23505' } });
    const writer = new SupabaseWriter(client);

    await expect(writer.upsertCostRecords([costRecord()])).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── writeIngestionLog ────────────────────────────────────────────────────────

describe('SupabaseWriter.writeIngestionLog', () => {
  it('inserts a log entry without throwing on success', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    await expect(writer.writeIngestionLog('usage', 42)).resolves.toBeUndefined();
    expect(client.from).toHaveBeenCalledWith('ingestion_log');
  });

  it('inserts the correct ingestion_type and records_written', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    await writer.writeIngestionLog('costs', 7);

    const inserted = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(inserted.ingestion_type).toBe('costs');
    expect(inserted.records_written).toBe(7);
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeInsertClient({ error: { message: 'write failed', code: '500' } });
    const writer = new SupabaseWriter(client);

    await expect(writer.writeIngestionLog('usage', 0)).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── writeForecastResults ─────────────────────────────────────────────────────

describe('SupabaseWriter.writeForecastResults', () => {
  it('returns 0 and skips the DB call when scenarios have no points', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    const count = await writer.writeForecastResults('run-1', '2026-04-28T00:00:00Z', 90, []);
    expect(count).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('inserts one row per scenario × forecast point', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    const scenarios = [
      { scenario: 'low' as const, annualGrowthRate: 0.05, points: [{ date: '2026-05-01', predictedCostUsd: 21 }, { date: '2026-05-02', predictedCostUsd: 21.1 }] },
      { scenario: 'high' as const, annualGrowthRate: 0.30, points: [{ date: '2026-05-01', predictedCostUsd: 22 }, { date: '2026-05-02', predictedCostUsd: 22.5 }] },
    ];
    const count = await writer.writeForecastResults('run-1', '2026-04-28T00:00:00Z', 90, scenarios);

    expect(count).toBe(4);
    expect(client.from).toHaveBeenCalledWith('forecast_results');
  });

  it('includes run_id, scenario, and forecast_date in each inserted row', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    await writer.writeForecastResults('run-abc', '2026-04-28T00:00:00Z', 30, [
      { scenario: 'medium' as const, annualGrowthRate: 0.15, points: [{ date: '2026-05-01', predictedCostUsd: 25 }] },
    ]);

    const rows = mockInsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows[0].run_id).toBe('run-abc');
    expect(rows[0].scenario).toBe('medium');
    expect(rows[0].forecast_date).toBe('2026-05-01');
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeInsertClient({ error: { message: 'insert failed', code: '500' } });
    const writer = new SupabaseWriter(client);

    await expect(
      writer.writeForecastResults('run-1', '2026-04-28T00:00:00Z', 90, [
        { scenario: 'low' as const, annualGrowthRate: 0.05, points: [{ date: '2026-05-01', predictedCostUsd: 21 }] },
      ])
    ).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── writeModelEfficiencySnapshot ────────────────────────────────────────────

describe('SupabaseWriter.writeModelEfficiencySnapshot', () => {
  it('returns 0 and skips the DB call for an empty array', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    expect(await writer.writeModelEfficiencySnapshot([])).toBe(0);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('inserts one row per model and returns the count', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    const snapshots = [
      { model: 'claude-a', totalCostUsd: 10, totalTokens: 1_000_000, costPerMillionTokens: 10, analysisWindowDays: 30 },
      { model: 'claude-b', totalCostUsd: 5, totalTokens: 500_000, costPerMillionTokens: 10, analysisWindowDays: 30 },
    ];
    const count = await writer.writeModelEfficiencySnapshot(snapshots);

    expect(count).toBe(2);
    expect(client.from).toHaveBeenCalledWith('model_efficiency_snapshots');
  });

  it('maps fields correctly into the inserted rows', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const writer = new SupabaseWriter(client);

    await writer.writeModelEfficiencySnapshot([
      { model: 'claude-x', totalCostUsd: 3.5, totalTokens: 700_000, costPerMillionTokens: 5.0, analysisWindowDays: 14 },
    ]);

    const row = (mockInsert.mock.calls[0][0] as Array<Record<string, unknown>>)[0];
    expect(row.model).toBe('claude-x');
    expect(row.cost_per_million_tokens).toBe(5.0);
    expect(row.total_tokens).toBe(700_000);
    expect(row.analysis_days).toBe(14);
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeInsertClient({ error: { message: 'insert failed', code: '500' } });
    const writer = new SupabaseWriter(client);

    await expect(
      writer.writeModelEfficiencySnapshot([
        { model: 'claude-a', totalCostUsd: 1, totalTokens: 100_000, costPerMillionTokens: 10, analysisWindowDays: 7 },
      ])
    ).rejects.toBeInstanceOf(StorageError);
  });
});
