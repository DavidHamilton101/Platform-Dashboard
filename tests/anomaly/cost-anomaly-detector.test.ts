import { describe, it, expect } from 'vitest';
import type { DailyCostSeriesRow } from '../../src/storage/supabase-reader';
import { detectCostAnomaly } from '../../src/anomaly/cost-anomaly-detector';
import type { CostAnomalyConfig } from '../../src/anomaly/cost-anomaly-detector';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const config: CostAnomalyConfig = {
  windowDays: 7,
  multiplier: 3,
  dailyThresholdUsd: 100,
  totalThresholdUsd: 500,
};

function row(day: string, amount: number): DailyCostSeriesRow {
  return { day, total_amount_usd: amount };
}

// ─── detectCostAnomaly ────────────────────────────────────────────────────────

describe('detectCostAnomaly', () => {
  it('returns null when fewer than 2 rows', () => {
    expect(detectCostAnomaly([row('2026-04-28', 50)], config)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(detectCostAnomaly([], config)).toBeNull();
  });

  it('returns null when spend is within normal range', () => {
    const rows = [
      row('2026-04-21', 20),
      row('2026-04-22', 25),
      row('2026-04-23', 22),
      row('2026-04-28', 28), // today — well below multiplier and thresholds
    ];
    expect(detectCostAnomaly(rows, config)).toBeNull();
  });

  it('returns warning when today exceeds multiplier threshold', () => {
    const rows = [
      row('2026-04-21', 20),
      row('2026-04-22', 20),
      row('2026-04-23', 20),
      row('2026-04-28', 90), // 4.5x average — below daily absolute but above multiplier
    ];
    const result = detectCostAnomaly(rows, config);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('cost_anomaly');
    expect(result?.severity).toBe('warning');
  });

  it('returns critical when today exceeds daily threshold', () => {
    const rows = [
      row('2026-04-21', 10),
      row('2026-04-22', 10),
      row('2026-04-28', 150), // > $100 daily threshold
    ];
    const result = detectCostAnomaly(rows, config);
    expect(result?.severity).toBe('critical');
    expect(result?.message).toContain('daily spend');
  });

  it('returns critical when period total exceeds total threshold', () => {
    const rows = [
      row('2026-04-21', 80),
      row('2026-04-22', 80),
      row('2026-04-23', 80),
      row('2026-04-24', 80),
      row('2026-04-25', 80),
      row('2026-04-26', 80),
      row('2026-04-28', 80), // period total = 560 > 500
    ];
    const result = detectCostAnomaly(rows, config);
    expect(result?.severity).toBe('critical');
    expect(result?.message).toContain('period total');
  });

  it('uses the most recent day as today regardless of input order', () => {
    const rows = [
      row('2026-04-28', 150), // highest date — should be today
      row('2026-04-21', 10),
      row('2026-04-22', 10),
    ];
    const result = detectCostAnomaly(rows, config);
    expect(result?.metadata.day).toBe('2026-04-28');
  });

  it('includes day, baseline, and thresholds in metadata', () => {
    const rows = [
      row('2026-04-21', 10),
      row('2026-04-28', 150),
    ];
    const result = detectCostAnomaly(rows, config);
    expect(result?.metadata).toMatchObject({
      day: '2026-04-28',
      dailyCostUsd: 150,
      dailyThresholdUsd: 100,
    });
  });

  it('returns null when baseline is zero and today is below all thresholds', () => {
    const rows = [
      row('2026-04-21', 0),
      row('2026-04-28', 50),
    ];
    expect(detectCostAnomaly(rows, config)).toBeNull();
  });
});
