import { validateEnv } from '../utils/env-validator';
import { createModuleLogger } from '../utils/logger';
import { ValidationError } from '../utils/error-handler';
import { anthropicFetch, type FetchOptions } from './http-client';
import type { UsageBucket, UsageReportResponse } from './types';

const logger = createModuleLogger('ingestion:usage');

const USAGE_PATH = '/v1/organizations/usage_report/messages';
const PAGE_LIMIT = 100;

/**
 * Fetches daily usage buckets for the given date range.
 * Handles pagination automatically — all pages are concatenated before returning.
 */
export async function fetchUsageReport(
  startTime: Date,
  endTime: Date,
  options: FetchOptions = {}
): Promise<UsageBucket[]> {
  const env = validateEnv();

  // Confirm presence only — never log the key value
  logger.info({ apiKeyPresent: Boolean(env.ANTHROPIC_ADMIN_API_KEY) }, 'Fetching usage report');

  const results: UsageBucket[] = [];
  let afterId: string | undefined;

  do {
    const params: Record<string, string> = {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      bucket_width: '1d',
      limit: String(PAGE_LIMIT),
    };

    if (afterId) {
      params['after_id'] = afterId;
    }

    const raw = await anthropicFetch(USAGE_PATH, env.ANTHROPIC_ADMIN_API_KEY, params, options);

    if (!isUsageReportResponse(raw)) {
      throw new ValidationError('Unexpected response shape from usage report endpoint');
    }

    results.push(...raw.data);
    afterId = raw.has_more && raw.last_id ? raw.last_id : undefined;

    logger.debug(
      { pageSize: raw.data.length, total: results.length, hasMore: raw.has_more },
      'Usage page fetched'
    );
  } while (afterId);

  logger.info({ total: results.length }, 'Usage report complete');
  return results;
}

/**
 * Groups usage buckets by a composite key of model + workspace.
 */
export function groupByModelAndWorkspace(
  buckets: UsageBucket[]
): Map<string, UsageBucket[]> {
  const groups = new Map<string, UsageBucket[]>();

  for (const bucket of buckets) {
    const key = `${bucket.model}:${bucket.workspace_id ?? 'default'}`;
    const existing = groups.get(key) ?? [];
    existing.push(bucket);
    groups.set(key, existing);
  }

  return groups;
}

function isUsageReportResponse(value: unknown): value is UsageReportResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray((value as UsageReportResponse).data) &&
    'has_more' in value &&
    typeof (value as UsageReportResponse).has_more === 'boolean'
  );
}
