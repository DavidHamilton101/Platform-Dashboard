import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UsageBucket } from '../../src/ingestion/types';

vi.mock('../../src/ingestion/http-client', () => ({ anthropicFetch: vi.fn() }));
vi.mock('../../src/utils/env-validator', () => ({
  validateEnv: () => ({
    ANTHROPIC_ADMIN_API_KEY: 'test-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    DASHBOARD_API_KEY: 'test-dashboard-key',
    ALERT_WEBHOOK_URL: 'https://hooks.example.com/test',
    COST_ALERT_THRESHOLD_USD: 100,
    ENVIRONMENT: 'development' as const,
  }),
}));

// Imported after mocks are registered
const { fetchUsageReport } = await import('../../src/ingestion/anthropic-usage');
const { anthropicFetch } = await import('../../src/ingestion/http-client');
const mockAnthropicFetch = vi.mocked(anthropicFetch);

const bucket = (model: string): UsageBucket => ({
  timestamp: '2026-04-01T00:00:00Z',
  organization_id: 'org-1',
  workspace_id: 'ws-1',
  model,
  input_tokens: 1_000,
  output_tokens: 500,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
});

const page = (data: UsageBucket[], hasMore: boolean, lastId: string | null = null) => ({
  object: 'list',
  data,
  has_more: hasMore,
  first_id: data[0] ? 'first' : null,
  last_id: lastId,
});

describe('fetchUsageReport — pagination', () => {
  beforeEach(() => mockAnthropicFetch.mockReset());

  it('returns all results from a single-page response', async () => {
    mockAnthropicFetch.mockResolvedValueOnce(
      page([bucket('claude-3-5-sonnet-20241022')], false)
    );

    const result = await fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'));

    expect(result).toHaveLength(1);
    expect(mockAnthropicFetch).toHaveBeenCalledTimes(1);
  });

  it('fetches multiple pages and concatenates all results', async () => {
    mockAnthropicFetch
      .mockResolvedValueOnce(
        page([bucket('claude-3-5-sonnet-20241022'), bucket('claude-3-haiku-20240307')], true, 'cursor-1')
      )
      .mockResolvedValueOnce(
        page([bucket('claude-3-opus-20240229')], false)
      );

    const result = await fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'));

    expect(result).toHaveLength(3);
    expect(mockAnthropicFetch).toHaveBeenCalledTimes(2);
  });

  it('passes the last_id cursor in the second page request', async () => {
    mockAnthropicFetch
      .mockResolvedValueOnce(page([bucket('claude-a')], true, 'cursor-abc'))
      .mockResolvedValueOnce(page([], false));

    await fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'));

    const secondCallParams = mockAnthropicFetch.mock.calls[1][2] as Record<string, string>;
    expect(secondCallParams['after_id']).toBe('cursor-abc');
  });

  it('does not include after_id on the first page request', async () => {
    mockAnthropicFetch.mockResolvedValueOnce(page([], false));

    await fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'));

    const firstCallParams = mockAnthropicFetch.mock.calls[0][2] as Record<string, string>;
    expect(firstCallParams['after_id']).toBeUndefined();
  });

  it('stops paginating when has_more is false', async () => {
    mockAnthropicFetch.mockResolvedValueOnce(
      page([bucket('claude-3-5-sonnet-20241022')], false)
    );

    await fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'));

    expect(mockAnthropicFetch).toHaveBeenCalledTimes(1);
  });

  it('stops paginating when has_more is true but last_id is null', async () => {
    // Defensive: malformed response with has_more true but no cursor
    mockAnthropicFetch.mockResolvedValueOnce(
      page([bucket('claude-a')], true, null)
    );

    const result = await fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'));

    expect(result).toHaveLength(1);
    expect(mockAnthropicFetch).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when the first page has no data', async () => {
    mockAnthropicFetch.mockResolvedValueOnce(page([], false));

    const result = await fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'));

    expect(result).toEqual([]);
  });
});
