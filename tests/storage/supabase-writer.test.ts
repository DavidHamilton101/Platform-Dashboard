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
