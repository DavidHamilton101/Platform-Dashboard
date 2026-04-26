import { ApiError } from '../utils/error-handler';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('http-client');

export const BASE_URL = 'https://api.anthropic.com';
export const ANTHROPIC_VERSION = '2023-06-01';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export interface FetchOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  // Injected in tests to avoid real delays
  sleepFn?: (ms: number) => Promise<void>;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches a JSON response from the Anthropic Admin API.
 * Retries with exponential backoff on 429 (rate limit) or 5xx (server error).
 * Never logs the API key value — only confirms HTTP status and path.
 */
export async function anthropicFetch(
  path: string,
  apiKey: string,
  params: Record<string, string>,
  options: FetchOptions = {}
): Promise<unknown> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sleepFn = options.sleepFn ?? sleep;

  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;

    try {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Network error or timeout — retry up to maxRetries
      logger.warn({ attempt, path }, 'Network error or timeout');
      if (attempt === maxRetries) {
        throw new ApiError('Network error or timeout reaching Anthropic API', {
          cause: err,
          severity: 'critical',
        });
      }
      await sleepFn(baseDelay * Math.pow(2, attempt));
      continue;
    }

    logger.info({ status: response.status, path, attempt }, 'Anthropic API response');

    if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
      if (attempt === maxRetries) {
        throw new ApiError(
          `Anthropic API failed after ${maxRetries + 1} attempts: HTTP ${response.status}`,
          { severity: 'critical' }
        );
      }
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn({ attempt, delay, status: response.status, path }, 'Retrying after backoff');
      await sleepFn(delay);
      continue;
    }

    if (!response.ok) {
      // 4xx errors other than 429 are not retried
      throw new ApiError(`Anthropic API request failed: HTTP ${response.status}`, {
        severity: 'critical',
      });
    }

    return response.json() as Promise<unknown>;
  }

  // Unreachable — loop always throws or returns before here
  throw new ApiError('Unexpected exit from retry loop', { severity: 'critical' });
}
