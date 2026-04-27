import cron from 'node-cron';
import { createModuleLogger } from '../utils/logger';
import { ApiError } from '../utils/error-handler';
import { fetchUsageReport, groupByModelAndWorkspace } from './anthropic-usage';
import { fetchCostReport } from './anthropic-costs';
import type { IngestionType } from './types';

const logger = createModuleLogger('ingestion:scheduler');

// Minimum elapsed time before re-fetching, to prevent duplicate records.
// Set just below each cron interval so a single missed tick doesn't block the next.
const MIN_USAGE_INTERVAL_MS = 55 * 60 * 1_000;       // 55 min (cron: hourly)
const MIN_COSTS_INTERVAL_MS = 23 * 60 * 60 * 1_000;  // 23 hr  (cron: daily at 02:00)

/**
 * Abstraction over the last-run timestamp store.
 * Implemented against Supabase in /src/storage (Phase 1 storage PR).
 * Injected here to keep the scheduler independently testable.
 */
export interface IngestionStateStore {
  getLastRunAt(type: IngestionType): Promise<Date | null>;
  setLastRunAt(type: IngestionType, timestamp: Date): Promise<void>;
}

export async function runUsageIngestion(
  store: IngestionStateStore,
  now: Date = new Date()
): Promise<void> {
  const lastRun = await store.getLastRunAt('usage');

  if (lastRun && now.getTime() - lastRun.getTime() < MIN_USAGE_INTERVAL_MS) {
    logger.info({ lastRun }, 'Skipping usage ingestion — ran recently');
    return;
  }

  const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  logger.info({ startTime, endTime: now }, 'Starting usage ingestion');

  try {
    const buckets = await fetchUsageReport(startTime, now);
    const groups = groupByModelAndWorkspace(buckets);

    logger.info(
      { buckets: buckets.length, groups: groups.size, completedAt: now },
      'Usage ingestion succeeded'
    );

    await store.setLastRunAt('usage', now);
  } catch (err) {
    if (err instanceof ApiError) {
      logger.error(
        { message: err.message, severity: err.severity },
        'Usage ingestion failed — API error'
      );
    } else {
      logger.error({ err }, 'Usage ingestion failed — unexpected error');
    }
    throw err;
  }
}

export async function runCostIngestion(
  store: IngestionStateStore,
  now: Date = new Date()
): Promise<void> {
  const lastRun = await store.getLastRunAt('costs');

  if (lastRun && now.getTime() - lastRun.getTime() < MIN_COSTS_INTERVAL_MS) {
    logger.info({ lastRun }, 'Skipping cost ingestion — ran recently');
    return;
  }

  const startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  logger.info({ startTime, endTime: now }, 'Starting cost ingestion');

  try {
    const records = await fetchCostReport(startTime, now);

    logger.info(
      { records: records.length, completedAt: now },
      'Cost ingestion succeeded'
    );

    await store.setLastRunAt('costs', now);
  } catch (err) {
    if (err instanceof ApiError) {
      logger.error(
        { message: err.message, severity: err.severity },
        'Cost ingestion failed — API error'
      );
    } else {
      logger.error({ err }, 'Cost ingestion failed — unexpected error');
    }
    throw err;
  }
}

export function startScheduler(store: IngestionStateStore): void {
  // Hourly usage ingestion
  cron.schedule('0 * * * *', async () => {
    try {
      await runUsageIngestion(store);
    } catch {
      logger.error('Scheduled usage ingestion failed — see previous error');
    }
  });

  // Daily cost ingestion at 02:00 local time
  cron.schedule('0 2 * * *', async () => {
    try {
      await runCostIngestion(store);
    } catch {
      logger.error('Scheduled cost ingestion failed — see previous error');
    }
  });

  logger.info('Ingestion scheduler started — usage: hourly, costs: daily at 02:00');
}
