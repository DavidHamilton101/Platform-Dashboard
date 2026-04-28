import { describe, it, expect } from 'vitest';
import type { DailyUsageRow } from '../../src/storage/supabase-reader';
import { detectTokenSpike } from '../../src/anomaly/token-spike-detector';
import type { TokenSpikeConfig } from '../../src/anomaly/token-spike-detector';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const config: TokenSpikeConfig = {
  windowDays: 7,
  multiplier: 3,
  absoluteThreshold: 1_000_000,
};

function makeRow(day: string, input: number, output: number): DailyUsageRow {
  return {
    recorded_at: `${day}T00:00:00Z`,
    model: 'claude-3-5-sonnet-20241022',
    workspace_id: 'ws-1',
    input_tokens: input,
    output_tokens: output,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
}

// ─── detectTokenSpike ─────────────────────────────────────────────────────────

describe('detectTokenSpike', () => {
  it('returns null when fewer than 2 distinct days', () => {
    const rows = [makeRow('2026-04-28', 100_000, 50_000)];
    expect(detectTokenSpike(rows, config)).toBeNull();
  });

  it('returns null when empty rows', () => {
    expect(detectTokenSpike([], config)).toBeNull();
  });

  it('returns null when today is within normal range', () => {
    const rows = [
      makeRow('2026-04-21', 100_000, 50_000),
      makeRow('2026-04-22', 110_000, 55_000),
      makeRow('2026-04-23', 90_000, 45_000),
      makeRow('2026-04-28', 120_000, 60_000), // today — normal
    ];
    expect(detectTokenSpike(rows, config)).toBeNull();
  });

  it('returns warning when today exceeds multiplier threshold', () => {
    // baseline = 150_000/day; today = 600_000 (4x) — above multiplier but below 1_000_000 absolute
    const rows = [
      makeRow('2026-04-21', 100_000, 50_000),
      makeRow('2026-04-22', 100_000, 50_000),
      makeRow('2026-04-23', 100_000, 50_000),
      makeRow('2026-04-28', 500_000, 100_000),
    ];
    const result = detectTokenSpike(rows, config);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('token_spike');
    expect(result?.severity).toBe('warning');
  });

  it('returns critical when today exceeds absolute threshold', () => {
    const rows = [
      makeRow('2026-04-21', 10_000, 5_000),
      makeRow('2026-04-22', 10_000, 5_000),
      makeRow('2026-04-28', 700_000, 400_000), // > 1_000_000 total
    ];
    const result = detectTokenSpike(rows, config);
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('critical');
  });

  it('includes today, baseline, and threshold in metadata', () => {
    const rows = [
      makeRow('2026-04-21', 100_000, 50_000),
      makeRow('2026-04-28', 700_000, 400_000),
    ];
    const result = detectTokenSpike(rows, config);
    expect(result?.metadata).toMatchObject({
      today: '2026-04-28',
      multiplierThreshold: 3,
      absoluteThreshold: 1_000_000,
    });
  });

  it('aggregates multiple rows on the same day correctly', () => {
    const rows = [
      makeRow('2026-04-21', 100_000, 50_000),
      makeRow('2026-04-21', 100_000, 50_000), // same day — should be summed
      makeRow('2026-04-28', 100_000, 50_000), // today — normal relative to summed baseline
    ];
    // baseline = 300_000, today = 150_000 — no spike
    expect(detectTokenSpike(rows, config)).toBeNull();
  });

  it('fires when combined same-day today tokens exceed threshold', () => {
    const rows = [
      makeRow('2026-04-21', 10_000, 5_000),
      makeRow('2026-04-28', 500_000, 200_000),
      makeRow('2026-04-28', 400_000, 100_000), // total today = 1_200_000
    ];
    const result = detectTokenSpike(rows, config);
    expect(result?.severity).toBe('critical');
  });

  it('returns null when baseline is zero and today is below absolute threshold', () => {
    const rows = [
      makeRow('2026-04-21', 0, 0),
      makeRow('2026-04-28', 100_000, 50_000),
    ];
    expect(detectTokenSpike(rows, config)).toBeNull();
  });
});
