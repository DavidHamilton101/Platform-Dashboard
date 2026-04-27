import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseDescription, parseCostRecord } from '../../src/ingestion/anthropic-costs';
import { groupByModelAndWorkspace } from '../../src/ingestion/anthropic-usage';
import { ApiError, ValidationError } from '../../src/utils/error-handler';
import type { CostRecord, UsageBucket } from '../../src/ingestion/types';

// Mock http-client so usage/cost fetchers can be exercised without network calls.
// Direct ApiError/retry behaviour is tested exhaustively in retry-backoff.test.ts.
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

const { fetchUsageReport } = await import('../../src/ingestion/anthropic-usage');
const { fetchCostReport } = await import('../../src/ingestion/anthropic-costs');
const { anthropicFetch } = await import('../../src/ingestion/http-client');
const mockFetch = vi.mocked(anthropicFetch);

// ─── ApiError severity — verified at the error-handler level ─────────────────
// fetchUsageReport and fetchCostReport have no error handling of their own —
// they let ApiErrors from http-client propagate untouched.
// End-to-end ApiError behaviour (severity, retries, cause) is covered
// exhaustively in tests/ingestion/retry-backoff.test.ts.

describe('ApiError class — severity defaults', () => {
  it('has critical severity by default', () => {
    expect(new ApiError('fail').severity).toBe('critical');
  });

  it('accepts a warning severity override', () => {
    expect(new ApiError('fail', { severity: 'warning' }).severity).toBe('warning');
  });

  it('preserves the cause', () => {
    const cause = new Error('upstream');
    expect(new ApiError('fail', { cause }).cause).toBe(cause);
  });
});

// ─── ValidationError — malformed API responses ────────────────────────────────

describe('ValidationError on malformed usage report response', () => {
  beforeEach(() => mockFetch.mockReset());

  it('throws ValidationError when response has no data array', async () => {
    mockFetch.mockResolvedValue({ unexpected: 'shape' });

    await expect(
      fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when has_more field is missing', async () => {
    mockFetch.mockResolvedValue({ data: [], object: 'list' });

    await expect(
      fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when response is null', async () => {
    mockFetch.mockResolvedValue(null);

    await expect(
      fetchUsageReport(new Date('2026-03-26'), new Date('2026-04-26'))
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ValidationError on malformed cost report response', () => {
  beforeEach(() => mockFetch.mockReset());

  it('throws ValidationError when response has no data array', async () => {
    mockFetch.mockResolvedValue({ not_a_list: true });

    await expect(
      fetchCostReport(new Date('2026-03-26'), new Date('2026-04-26'))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws ValidationError when response is null', async () => {
    mockFetch.mockResolvedValue(null);

    await expect(
      fetchCostReport(new Date('2026-03-26'), new Date('2026-04-26'))
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

// ─── parseDescription ─────────────────────────────────────────────────────────

describe('parseDescription', () => {
  it('extracts model and input feature', () => {
    expect(parseDescription('claude-3-5-sonnet-20241022 input')).toEqual({
      model: 'claude-3-5-sonnet-20241022',
      feature: 'input',
    });
  });

  it('extracts model and multi-word feature', () => {
    expect(parseDescription('claude-3-haiku-20240307 prompt cache write')).toEqual({
      model: 'claude-3-haiku-20240307',
      feature: 'prompt cache write',
    });
  });

  it('extracts model with null feature when no suffix', () => {
    expect(parseDescription('claude-opus-4-5')).toEqual({
      model: 'claude-opus-4-5',
      feature: null,
    });
  });

  it('returns null for both when description does not match', () => {
    expect(parseDescription('unknown billing item')).toEqual({
      model: null,
      feature: null,
    });
  });

  it('returns null for both on empty string', () => {
    expect(parseDescription('')).toEqual({ model: null, feature: null });
  });

  it('handles output feature', () => {
    expect(parseDescription('claude-3-5-sonnet-20241022 output')).toEqual({
      model: 'claude-3-5-sonnet-20241022',
      feature: 'output',
    });
  });
});

// ─── parseCostRecord ──────────────────────────────────────────────────────────

describe('parseCostRecord', () => {
  const base: CostRecord = {
    timestamp: '2026-04-01T00:00:00Z',
    organization_id: 'org-1',
    workspace_id: 'ws-1',
    description: 'claude-3-5-sonnet-20241022 input',
    amount: { value: 12.50, currency: 'USD' },
  };

  it('preserves all original record fields', () => {
    const parsed = parseCostRecord(base);
    expect(parsed.timestamp).toBe(base.timestamp);
    expect(parsed.amount).toEqual(base.amount);
    expect(parsed.workspace_id).toBe('ws-1');
  });

  it('adds parsed model and feature', () => {
    const parsed = parseCostRecord(base);
    expect(parsed.model).toBe('claude-3-5-sonnet-20241022');
    expect(parsed.feature).toBe('input');
  });

  it('sets model and feature to null for unrecognised description', () => {
    const parsed = parseCostRecord({ ...base, description: 'platform fee' });
    expect(parsed.model).toBeNull();
    expect(parsed.feature).toBeNull();
  });
});

// ─── groupByModelAndWorkspace ─────────────────────────────────────────────────

const makeBucket = (model: string, workspaceId: string | null): UsageBucket => ({
  timestamp: '2026-04-01T00:00:00Z',
  organization_id: 'org-1',
  workspace_id: workspaceId,
  model,
  input_tokens: 1_000,
  output_tokens: 500,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
});

describe('groupByModelAndWorkspace', () => {
  it('groups by composite model:workspace key', () => {
    const groups = groupByModelAndWorkspace([
      makeBucket('claude-a', 'ws-1'),
      makeBucket('claude-a', 'ws-1'),
      makeBucket('claude-b', 'ws-2'),
    ]);

    expect(groups.size).toBe(2);
    expect(groups.get('claude-a:ws-1')).toHaveLength(2);
    expect(groups.get('claude-b:ws-2')).toHaveLength(1);
  });

  it('uses "default" as workspace segment for null workspace_id', () => {
    const groups = groupByModelAndWorkspace([makeBucket('claude-a', null)]);
    expect(groups.has('claude-a:default')).toBe(true);
  });

  it('creates separate groups for same model in different workspaces', () => {
    const groups = groupByModelAndWorkspace([
      makeBucket('claude-a', 'ws-1'),
      makeBucket('claude-a', 'ws-2'),
    ]);
    expect(groups.size).toBe(2);
  });

  it('returns empty map for empty input', () => {
    expect(groupByModelAndWorkspace([])).toEqual(new Map());
  });
});
