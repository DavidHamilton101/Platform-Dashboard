import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseReader } from '../../src/storage/supabase-reader';
import { StorageError } from '../../src/utils/error-handler';

// ─── Mock client helpers ──────────────────────────────────────────────────────

// Builds a mock that handles the chained select builder.
// The real Supabase builder is thenable — awaiting any step in the chain resolves
// the query. We replicate that here so tests work whether the terminal call is
// .gte(), .order(), or .maybeSingle().
function makeSelectClient(result: { data: unknown; error: object | null }): SupabaseClient {
  const resolved = Promise.resolve(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    gte: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  const selectMock = vi.fn().mockReturnValue(chain);
  return { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient;
}

// ─── getUsageSummary ──────────────────────────────────────────────────────────

describe('SupabaseReader.getUsageSummary', () => {
  it('returns an empty array when there are no rows', async () => {
    const client = makeSelectClient({ data: [], error: null });
    const reader = new SupabaseReader(client);

    await expect(reader.getUsageSummary(30)).resolves.toEqual([]);
  });

  it('aggregates tokens across multiple rows for the same model/workspace', async () => {
    const rows = [
      { model: 'claude-a', workspace_id: 'ws-1', input_tokens: 1_000, output_tokens: 500, cache_creation_input_tokens: 10, cache_read_input_tokens: 5 },
      { model: 'claude-a', workspace_id: 'ws-1', input_tokens: 2_000, output_tokens: 800, cache_creation_input_tokens: 20, cache_read_input_tokens: 8 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getUsageSummary(30);

    expect(result).toHaveLength(1);
    expect(result[0].total_input_tokens).toBe(3_000);
    expect(result[0].total_output_tokens).toBe(1_300);
  });

  it('creates separate summary rows for different model/workspace combinations', async () => {
    const rows = [
      { model: 'claude-a', workspace_id: 'ws-1', input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      { model: 'claude-b', workspace_id: 'ws-2', input_tokens: 200, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getUsageSummary(30);

    expect(result).toHaveLength(2);
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeSelectClient({ data: null, error: { message: 'query failed', code: '500' } });
    const reader = new SupabaseReader(client);

    await expect(reader.getUsageSummary(30)).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── getDailyUsage ────────────────────────────────────────────────────────────

describe('SupabaseReader.getDailyUsage', () => {
  it('returns rows as-is from the database', async () => {
    const rows = [
      { recorded_at: '2026-04-01T00:00:00Z', model: 'claude-a', workspace_id: 'ws-1', input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getDailyUsage(7);

    expect(result).toEqual(rows);
  });

  it('returns an empty array when there are no rows', async () => {
    const client = makeSelectClient({ data: [], error: null });
    const reader = new SupabaseReader(client);

    await expect(reader.getDailyUsage(7)).resolves.toEqual([]);
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeSelectClient({ data: null, error: { message: 'query failed', code: '500' } });
    const reader = new SupabaseReader(client);

    await expect(reader.getDailyUsage(7)).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── getLastIngestion ─────────────────────────────────────────────────────────

describe('SupabaseReader.getLastIngestion', () => {
  it('returns the most recent ingestion log row', async () => {
    const row = { ingestion_type: 'usage', last_fetched_at: '2026-04-25T02:00:00Z', records_written: 42 };
    const client = makeSelectClient({ data: row, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getLastIngestion();

    expect(result).toEqual(row);
  });

  it('returns null when the ingestion log is empty', async () => {
    const client = makeSelectClient({ data: null, error: null });
    const reader = new SupabaseReader(client);

    await expect(reader.getLastIngestion()).resolves.toBeNull();
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeSelectClient({ data: null, error: { message: 'query failed', code: '500' } });
    const reader = new SupabaseReader(client);

    await expect(reader.getLastIngestion()).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── getCostByWorkspace ───────────────────────────────────────────────────────

describe('SupabaseReader.getCostByWorkspace', () => {
  it('returns an empty array when there are no rows', async () => {
    const client = makeSelectClient({ data: [], error: null });
    const reader = new SupabaseReader(client);

    await expect(reader.getCostByWorkspace(30)).resolves.toEqual([]);
  });

  it('aggregates amount_usd across rows with the same workspace/model/cost_type', async () => {
    const rows = [
      { workspace_id: 'ws-1', model: 'claude-a', cost_type: 'input', amount_usd: 5.0 },
      { workspace_id: 'ws-1', model: 'claude-a', cost_type: 'input', amount_usd: 3.0 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getCostByWorkspace(30);

    expect(result).toHaveLength(1);
    expect(result[0].total_amount_usd).toBeCloseTo(8.0);
  });

  it('creates separate rows for different workspace/model/cost_type combinations', async () => {
    const rows = [
      { workspace_id: 'ws-1', model: 'claude-a', cost_type: 'input', amount_usd: 5.0 },
      { workspace_id: 'ws-2', model: 'claude-b', cost_type: 'output', amount_usd: 3.0 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getCostByWorkspace(30);

    expect(result).toHaveLength(2);
  });

  it('handles null model in cost rows', async () => {
    const rows = [
      { workspace_id: 'ws-1', model: null, cost_type: 'platform fee', amount_usd: 10.0 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getCostByWorkspace(30);

    expect(result[0].model).toBeNull();
    expect(result[0].total_amount_usd).toBeCloseTo(10.0);
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeSelectClient({ data: null, error: { message: 'query failed', code: '500' } });
    const reader = new SupabaseReader(client);

    await expect(reader.getCostByWorkspace(30)).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── getDailyCostSeries ───────────────────────────────────────────────────────

describe('SupabaseReader.getDailyCostSeries', () => {
  it('returns an empty array when there are no rows', async () => {
    const client = makeSelectClient({ data: [], error: null });
    const reader = new SupabaseReader(client);

    await expect(reader.getDailyCostSeries(7)).resolves.toEqual([]);
  });

  it('groups rows by day and sums amount_usd', async () => {
    const rows = [
      { recorded_at: '2026-04-21T00:00:00Z', amount_usd: 10.0 },
      { recorded_at: '2026-04-21T12:00:00Z', amount_usd: 5.0 },
      { recorded_at: '2026-04-22T00:00:00Z', amount_usd: 8.0 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getDailyCostSeries(7);

    expect(result).toHaveLength(2);
    expect(result.find(r => r.day === '2026-04-21')?.total_amount_usd).toBeCloseTo(15.0);
    expect(result.find(r => r.day === '2026-04-22')?.total_amount_usd).toBeCloseTo(8.0);
  });

  it('returns results sorted ascending by day', async () => {
    const rows = [
      { recorded_at: '2026-04-23T00:00:00Z', amount_usd: 5.0 },
      { recorded_at: '2026-04-21T00:00:00Z', amount_usd: 10.0 },
      { recorded_at: '2026-04-22T00:00:00Z', amount_usd: 8.0 },
    ];
    const client = makeSelectClient({ data: rows, error: null });
    const reader = new SupabaseReader(client);

    const result = await reader.getDailyCostSeries(7);

    expect(result.map(r => r.day)).toEqual(['2026-04-21', '2026-04-22', '2026-04-23']);
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeSelectClient({ data: null, error: { message: 'query failed', code: '500' } });
    const reader = new SupabaseReader(client);

    await expect(reader.getDailyCostSeries(7)).rejects.toBeInstanceOf(StorageError);
  });
});
