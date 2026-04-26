import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseIngestionStateStore } from '../../src/storage/ingestion-state-store';
import { StorageError } from '../../src/utils/error-handler';

// ─── Mock client helpers ──────────────────────────────────────────────────────

// Builds a chained select mock for: .from().select().eq().order().limit().maybeSingle()
function makeSelectClient(result: { data: unknown; error: object | null }): SupabaseClient {
  const chain = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return {
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chain) }),
  } as unknown as SupabaseClient;
}

function makeInsertClient(result: { error: object | null }): SupabaseClient {
  return {
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue(result) }),
  } as unknown as SupabaseClient;
}

// ─── getLastRunAt ─────────────────────────────────────────────────────────────

describe('SupabaseIngestionStateStore.getLastRunAt', () => {
  it('returns null when no row exists for the given ingestion type', async () => {
    const client = makeSelectClient({ data: null, error: null });
    const store = new SupabaseIngestionStateStore(client);

    await expect(store.getLastRunAt('usage')).resolves.toBeNull();
  });

  it('returns a Date parsed from the last_fetched_at column', async () => {
    const client = makeSelectClient({ data: { last_fetched_at: '2026-04-25T10:00:00Z' }, error: null });
    const store = new SupabaseIngestionStateStore(client);

    const result = await store.getLastRunAt('usage');

    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-04-25T10:00:00.000Z');
  });

  it('queries ingestion_log filtered by the correct ingestion type', async () => {
    const chain = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const eqSpy = chain.eq;
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(chain) }) } as unknown as SupabaseClient;
    const store = new SupabaseIngestionStateStore(client);

    await store.getLastRunAt('costs');

    expect(eqSpy).toHaveBeenCalledWith('ingestion_type', 'costs');
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeSelectClient({ data: null, error: { message: 'read failed', code: '500' } });
    const store = new SupabaseIngestionStateStore(client);

    await expect(store.getLastRunAt('usage')).rejects.toBeInstanceOf(StorageError);
  });
});

// ─── setLastRunAt ─────────────────────────────────────────────────────────────

describe('SupabaseIngestionStateStore.setLastRunAt', () => {
  it('resolves without throwing on success', async () => {
    const client = makeInsertClient({ error: null });
    const store = new SupabaseIngestionStateStore(client);
    const ts = new Date('2026-04-25T10:00:00Z');

    await expect(store.setLastRunAt('usage', ts)).resolves.toBeUndefined();
    expect(client.from).toHaveBeenCalledWith('ingestion_log');
  });

  it('inserts a row with the correct ingestion_type and ISO timestamp', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: mockInsert }) } as unknown as SupabaseClient;
    const store = new SupabaseIngestionStateStore(client);
    const ts = new Date('2026-04-25T10:00:00Z');

    await store.setLastRunAt('costs', ts);

    const row = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(row.ingestion_type).toBe('costs');
    expect(row.last_fetched_at).toBe('2026-04-25T10:00:00.000Z');
    expect(row.records_written).toBe(0);
  });

  it('throws StorageError when Supabase returns an error', async () => {
    const client = makeInsertClient({ error: { message: 'write failed', code: '500' } });
    const store = new SupabaseIngestionStateStore(client);

    await expect(store.setLastRunAt('usage', new Date())).rejects.toBeInstanceOf(StorageError);
  });
});
