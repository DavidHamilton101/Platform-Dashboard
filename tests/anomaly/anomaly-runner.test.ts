import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnomalyRunner } from '../../src/anomaly/anomaly-runner';
import type { SupabaseReader, DailyUsageRow, DailyCostSeriesRow } from '../../src/storage/supabase-reader';
import type { SupabaseWriter } from '../../src/storage/supabase-writer';
import type { TeamsAlerter } from '../../src/anomaly/teams-alerter';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeUsageRow(day: string, input: number, output: number): DailyUsageRow {
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

function makeCostRow(day: string, amount: number): DailyCostSeriesRow {
  return { day, total_amount_usd: amount };
}

function makeReader(
  usageRows: DailyUsageRow[],
  costRows: DailyCostSeriesRow[]
): SupabaseReader {
  return {
    getDailyUsage: vi.fn().mockResolvedValue(usageRows),
    getDailyCostSeries: vi.fn().mockResolvedValue(costRows),
  } as unknown as SupabaseReader;
}

function makeWriter(): SupabaseWriter {
  return {
    writeAlertLog: vi.fn().mockResolvedValue(undefined),
  } as unknown as SupabaseWriter;
}

function makeAlerter(): TeamsAlerter {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  } as unknown as TeamsAlerter;
}

// ─── AnomalyRunner.run ────────────────────────────────────────────────────────

describe('AnomalyRunner.run', () => {
  let writer: ReturnType<typeof makeWriter>;
  let alerter: ReturnType<typeof makeAlerter>;

  beforeEach(() => {
    writer = makeWriter();
    alerter = makeAlerter();
  });

  it('returns an empty array when no anomalies are detected', async () => {
    const reader = makeReader(
      [
        makeUsageRow('2026-04-21', 100_000, 50_000),
        makeUsageRow('2026-04-28', 110_000, 55_000),
      ],
      [
        makeCostRow('2026-04-21', 20),
        makeCostRow('2026-04-28', 22),
      ]
    );
    const runner = new AnomalyRunner(reader, writer, alerter);

    const result = await runner.run();

    expect(result).toHaveLength(0);
    expect(alerter.send).not.toHaveBeenCalled();
    expect(writer.writeAlertLog).not.toHaveBeenCalled();
  });

  it('returns detected anomalies and fires alerts', async () => {
    const reader = makeReader(
      [
        makeUsageRow('2026-04-21', 10_000, 5_000),
        makeUsageRow('2026-04-28', 900_000, 200_000), // token spike
      ],
      [
        makeCostRow('2026-04-21', 5),
        makeCostRow('2026-04-28', 5),
      ]
    );
    const runner = new AnomalyRunner(reader, writer, alerter);

    const result = await runner.run();

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(r => r.type === 'token_spike')).toBe(true);
    expect(alerter.send).toHaveBeenCalled();
    expect(writer.writeAlertLog).toHaveBeenCalled();
  });

  it('passes lookbackDays to both reader methods', async () => {
    const reader = makeReader([], []);
    const runner = new AnomalyRunner(reader, writer, alerter);

    await runner.run({ lookbackDays: 14 });

    expect(reader.getDailyUsage).toHaveBeenCalledWith(14);
    expect(reader.getDailyCostSeries).toHaveBeenCalledWith(14);
  });

  it('defaults lookbackDays to 8', async () => {
    const reader = makeReader([], []);
    const runner = new AnomalyRunner(reader, writer, alerter);

    await runner.run();

    expect(reader.getDailyUsage).toHaveBeenCalledWith(8);
  });

  it('continues processing remaining anomalies if one alert fails', async () => {
    const reader = makeReader(
      [
        makeUsageRow('2026-04-21', 10_000, 5_000),
        makeUsageRow('2026-04-28', 900_000, 200_000),
      ],
      [
        makeCostRow('2026-04-21', 5),
        makeCostRow('2026-04-28', 150), // also a cost anomaly if threshold is 100
      ]
    );
    (alerter.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('webhook down'));
    const runner = new AnomalyRunner(reader, writer, alerter);

    // Should not throw — errors are swallowed per-anomaly
    await expect(runner.run()).resolves.toBeDefined();
  });

  it('fires alert and writes log for each detected anomaly', async () => {
    const reader = makeReader(
      [
        makeUsageRow('2026-04-21', 10_000, 5_000),
        makeUsageRow('2026-04-28', 900_000, 200_000),
      ],
      [
        makeCostRow('2026-04-21', 5),
        makeCostRow('2026-04-28', 150),
      ]
    );
    const runner = new AnomalyRunner(reader, writer, alerter);

    const anomalies = await runner.run();

    expect(alerter.send).toHaveBeenCalledTimes(anomalies.length);
    expect(writer.writeAlertLog).toHaveBeenCalledTimes(anomalies.length);
  });
});
