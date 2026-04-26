import { validateEnv } from '../utils/env-validator';
import { createModuleLogger } from '../utils/logger';
import { ValidationError } from '../utils/error-handler';
import { anthropicFetch, type FetchOptions } from './http-client';
import type { CostRecord, CostReportResponse, ParsedCostRecord } from './types';

const logger = createModuleLogger('ingestion:costs');

const COSTS_PATH = '/v1/organizations/cost_report';
const PAGE_LIMIT = 100;

/**
 * Fetches daily cost records grouped by workspace_id and description.
 * Handles pagination automatically and enriches each record with parsed
 * model and feature fields extracted from the description string.
 */
export async function fetchCostReport(
  startTime: Date,
  endTime: Date,
  options: FetchOptions = {}
): Promise<ParsedCostRecord[]> {
  const env = validateEnv();

  logger.info({ apiKeyPresent: Boolean(env.ANTHROPIC_ADMIN_API_KEY) }, 'Fetching cost report');

  const results: ParsedCostRecord[] = [];
  let afterId: string | undefined;

  do {
    const params: Record<string, string> = {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      limit: String(PAGE_LIMIT),
    };

    if (afterId) {
      params['after_id'] = afterId;
    }

    const raw = await anthropicFetch(COSTS_PATH, env.ANTHROPIC_ADMIN_API_KEY, params, options);

    if (!isCostReportResponse(raw)) {
      throw new ValidationError('Unexpected response shape from cost report endpoint');
    }

    for (const record of raw.data) {
      results.push(parseCostRecord(record));
    }

    afterId = raw.has_more && raw.last_id ? raw.last_id : undefined;

    logger.debug(
      { pageSize: raw.data.length, total: results.length, hasMore: raw.has_more },
      'Cost page fetched'
    );
  } while (afterId);

  logger.info({ total: results.length }, 'Cost report complete');
  return results;
}

export function parseCostRecord(record: CostRecord): ParsedCostRecord {
  return { ...record, ...parseDescription(record.description) };
}

/**
 * Extracts model name and feature context from Anthropic cost description strings.
 *
 * Examples:
 *   "claude-3-5-sonnet-20241022 input"           → { model: "claude-3-5-sonnet-20241022", feature: "input" }
 *   "claude-3-haiku-20240307 prompt cache write" → { model: "claude-3-haiku-20240307", feature: "prompt cache write" }
 *   "claude-opus-4-5"                            → { model: "claude-opus-4-5", feature: null }
 *   "unknown billing item"                       → { model: null, feature: null }
 */
export function parseDescription(description: string): { model: string | null; feature: string | null } {
  // Matches claude- followed by alphanumeric segments separated by hyphens
  const match = description.match(/^(claude-[a-z0-9]+(?:-[a-z0-9]+)*)(?:\s+(.+))?$/i);

  if (!match) {
    return { model: null, feature: null };
  }

  return {
    model: match[1] ?? null,
    feature: match[2]?.trim() ?? null,
  };
}

function isCostReportResponse(value: unknown): value is CostReportResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    Array.isArray((value as CostReportResponse).data) &&
    'has_more' in value &&
    typeof (value as CostReportResponse).has_more === 'boolean'
  );
}
