import { describe, it, expect, vi } from 'vitest';
import {
  runUsageIngestion,
  runCostIngestion,
  startScheduler,
  type IngestionStateStore,
} from '../../src/ingestion/scheduler';

vi.mock('../../src/ingestion/anthropic-usage', () => ({
  fetchUsageReport: vi.fn().mockResolvedValue([]),
  groupByModelAndWorkspace: vi.fn().mockReturnValue(new Map()),
}));
vi.mock('../../src/ingestion/anthropic-costs', () => ({
  fetchCostReport: vi.fn().mockResolvedValue([]),
}));
vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }));

function makeStore(lastRunAt: Date | null): IngestionStateStore {
  return {
    getLastRunAt: vi.fn().mockResolvedValue(lastRunAt),
    setLastRunAt: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Usage deduplication ──────────────────────────────────────────────────────

describe('runUsageIngestion — duplicate detection', () => {
  it('runs and records timestamp when no previous run exists', async () => {
    const store = makeStore(null);
    const now = new Date('2026-04-26T10:00:00Z');

    await runUsageIngestion(store, now);

    expect(store.setLastRunAt).toHaveBeenCalledWith('usage', now);
  });

  it('skips when last run is within the 55-minute minimum interval', async () => {
    const now = new Date('2026-04-26T10:00:00Z');
    const recentRun = new Date(now.getTime() - 10 * 60 * 1_000); // 10 min ago

    const store = makeStore(recentRun);
    await runUsageIngestion(store, now);

    expect(store.setLastRunAt).not.toHaveBeenCalled();
  });

  it('runs when last run just exceeds the 55-minute minimum interval', async () => {
    const now = new Date('2026-04-26T10:00:00Z');
    const oldRun = new Date(now.getTime() - 56 * 60 * 1_000); // 56 min ago

    const store = makeStore(oldRun);
    await runUsageIngestion(store, now);

    expect(store.setLastRunAt).toHaveBeenCalledWith('usage', now);
  });

  it('queries the store with the correct ingestion type', async () => {
    const store = makeStore(null);
    await runUsageIngestion(store, new Date());

    expect(store.getLastRunAt).toHaveBeenCalledWith('usage');
  });
});

// ─── Cost deduplication ───────────────────────────────────────────────────────

describe('runCostIngestion — duplicate detection', () => {
  it('runs and records timestamp when no previous run exists', async () => {
    const store = makeStore(null);
    const now = new Date('2026-04-26T02:00:00Z');

    await runCostIngestion(store, now);

    expect(store.setLastRunAt).toHaveBeenCalledWith('costs', now);
  });

  it('skips when last run is within the 23-hour minimum interval', async () => {
    const now = new Date('2026-04-26T02:00:00Z');
    const recentRun = new Date(now.getTime() - 12 * 60 * 60 * 1_000); // 12 hr ago

    const store = makeStore(recentRun);
    await runCostIngestion(store, now);

    expect(store.setLastRunAt).not.toHaveBeenCalled();
  });

  it('runs when last run just exceeds the 23-hour minimum interval', async () => {
    const now = new Date('2026-04-26T02:00:00Z');
    const oldRun = new Date(now.getTime() - 24 * 60 * 60 * 1_000); // 24 hr ago

    const store = makeStore(oldRun);
    await runCostIngestion(store, now);

    expect(store.setLastRunAt).toHaveBeenCalledWith('costs', now);
  });

  it('queries the store with the correct ingestion type', async () => {
    const store = makeStore(null);
    await runCostIngestion(store, new Date());

    expect(store.getLastRunAt).toHaveBeenCalledWith('costs');
  });
});

// ─── Scheduler setup ─────────────────────────────────────────────────────────

describe('startScheduler', () => {
  it('schedules usage ingestion with an hourly cron expression', async () => {
    const cron = (await import('node-cron')).default;
    const store = makeStore(null);

    startScheduler(store);

    expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function));
  });

  it('schedules cost ingestion with a daily 02:00 cron expression', async () => {
    const cron = (await import('node-cron')).default;
    const store = makeStore(null);

    startScheduler(store);

    expect(cron.schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
  });
});
