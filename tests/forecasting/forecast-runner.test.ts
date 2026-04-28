import { describe, it, expect, vi } from 'vitest';
import { ForecastRunner } from '../../src/forecasting/forecast-runner';
import type { SupabaseReader, DailyCostSeriesRow, UsageSummaryRow, CostByWorkspaceRow } from '../../src/storage/supabase-reader';
import type { SupabaseWriter } from '../../src/storage/supabase-writer';

// ─── Mock factories ───────────────────────────────────────────────────────────

function makeReader(
  costSeries: DailyCostSeriesRow[],
  usageSummary: UsageSummaryRow[],
  costByWorkspace: CostByWorkspaceRow[]
): SupabaseReader {
  return {
    getDailyCostSeries: vi.fn().mockResolvedValue(costSeries),
    getUsageSummary: vi.fn().mockResolvedValue(usageSummary),
    getCostByWorkspace: vi.fn().mockResolvedValue(costByWorkspace),
  } as unknown as SupabaseReader;
}

function makeWriter(): SupabaseWriter {
  return {
    writeForecastResults: vi.fn().mockResolvedValue(270),
    writeModelEfficiencySnapshot: vi.fn().mockResolvedValue(2),
  } as unknown as SupabaseWriter;
}

function costSeries(days: number): DailyCostSeriesRow[] {
  return Array.from({ length: days }, (_, i) => ({
    day: new Date(Date.now() - (days - i) * 86_400_000).toISOString().slice(0, 10),
    total_amount_usd: 20 + i * 0.5,
  }));
}

// ─── ForecastRunner.run ───────────────────────────────────────────────────────

describe('ForecastRunner.run', () => {
  it('returns a ForecastRun with a runId, regression, scenarios, and efficiency', async () => {
    const runner = new ForecastRunner(makeReader(costSeries(30), [], []), makeWriter());
    const result = await runner.run({ historyDays: 30, horizonDays: 10 });

    expect(result.runId).toBeTruthy();
    expect(result.regression.dataPoints).toBe(30);
    expect(result.scenarios).toHaveLength(3);
    expect(result.scenarios.map(s => s.scenario)).toEqual(['low', 'medium', 'high']);
    expect(result.horizonDays).toBe(10);
    expect(result.historyDays).toBe(30);
  });

  it('each scenario has horizonDays forecast points', async () => {
    const runner = new ForecastRunner(makeReader(costSeries(30), [], []), makeWriter());
    const result = await runner.run({ historyDays: 30, horizonDays: 7 });

    for (const scenario of result.scenarios) {
      expect(scenario.points).toHaveLength(7);
    }
  });

  it('passes historyDays to all three reader methods', async () => {
    const reader = makeReader(costSeries(14), [], []);
    const runner = new ForecastRunner(reader, makeWriter());
    await runner.run({ historyDays: 14, horizonDays: 30 });

    expect(reader.getDailyCostSeries).toHaveBeenCalledWith(14);
    expect(reader.getUsageSummary).toHaveBeenCalledWith(14);
    expect(reader.getCostByWorkspace).toHaveBeenCalledWith(14);
  });

  it('calls writeForecastResults and writeModelEfficiencySnapshot', async () => {
    const writer = makeWriter();
    const runner = new ForecastRunner(makeReader(costSeries(30), [], []), writer);
    const result = await runner.run({ historyDays: 30, horizonDays: 5 });

    expect(writer.writeForecastResults).toHaveBeenCalledWith(
      result.runId, result.generatedAt, 5, result.scenarios
    );
    expect(writer.writeModelEfficiencySnapshot).toHaveBeenCalledWith(result.modelEfficiency);
  });

  it('handles fewer than 2 days of cost data without throwing', async () => {
    const runner = new ForecastRunner(
      makeReader([{ day: '2026-04-28', total_amount_usd: 20 }], [], []),
      makeWriter()
    );
    await expect(runner.run({ historyDays: 30, horizonDays: 5 })).resolves.toBeDefined();
  });

  it('defaults historyDays and horizonDays from env when options are omitted', async () => {
    const reader = makeReader(costSeries(30), [], []);
    const runner = new ForecastRunner(reader, makeWriter());
    // env vars not set — should fall back to coded defaults (30/90)
    await runner.run();
    expect(reader.getDailyCostSeries).toHaveBeenCalledWith(30);
  });

  it('includes modelEfficiency in the returned result', async () => {
    const usage: UsageSummaryRow[] = [{
      model: 'claude-a', workspace_id: 'ws-1',
      total_input_tokens: 100_000, total_output_tokens: 50_000,
      total_cache_creation_tokens: 0, total_cache_read_tokens: 0,
    }];
    const costs: CostByWorkspaceRow[] = [
      { workspace_id: 'ws-1', model: 'claude-a', cost_type: 'input', total_amount_usd: 3.0 },
    ];
    const runner = new ForecastRunner(makeReader(costSeries(30), usage, costs), makeWriter());
    const result = await runner.run({ historyDays: 30, horizonDays: 5 });

    expect(result.modelEfficiency).toHaveLength(1);
    expect(result.modelEfficiency[0].model).toBe('claude-a');
  });
});
