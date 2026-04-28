import { describe, it, expect } from 'vitest';
import { computeModelEfficiency } from '../../src/forecasting/model-efficiency';
import type { UsageSummaryRow, CostByWorkspaceRow } from '../../src/storage/supabase-reader';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function usageRow(model: string, input: number, output: number): UsageSummaryRow {
  return {
    model,
    workspace_id: 'ws-1',
    total_input_tokens: input,
    total_output_tokens: output,
    total_cache_creation_tokens: 0,
    total_cache_read_tokens: 0,
  };
}

function costRow(model: string, amount: number): CostByWorkspaceRow {
  return { workspace_id: 'ws-1', model, cost_type: 'input', total_amount_usd: amount };
}

// ─── computeModelEfficiency ───────────────────────────────────────────────────

describe('computeModelEfficiency', () => {
  it('returns an empty array when there is no usage data', () => {
    expect(computeModelEfficiency([], [], 30)).toEqual([]);
  });

  it('computes cost per million tokens correctly', () => {
    // 1_000_000 tokens, $2 cost → $2 per million tokens
    const result = computeModelEfficiency(
      [usageRow('claude-a', 500_000, 500_000)],
      [costRow('claude-a', 2.0)],
      30
    );
    expect(result).toHaveLength(1);
    expect(result[0].costPerMillionTokens).toBeCloseTo(2.0, 4);
  });

  it('assigns zero cost when no cost data is available for a model', () => {
    const result = computeModelEfficiency(
      [usageRow('claude-a', 100_000, 50_000)],
      [],
      30
    );
    expect(result[0].totalCostUsd).toBe(0);
    expect(result[0].costPerMillionTokens).toBe(0);
  });

  it('sorts results cheapest-first by costPerMillionTokens', () => {
    const usage = [
      usageRow('claude-expensive', 100_000, 100_000),
      usageRow('claude-cheap', 100_000, 100_000),
    ];
    const costs = [
      costRow('claude-expensive', 10.0),
      costRow('claude-cheap', 1.0),
    ];
    const result = computeModelEfficiency(usage, costs, 30);
    expect(result[0].model).toBe('claude-cheap');
    expect(result[1].model).toBe('claude-expensive');
  });

  it('aggregates tokens across multiple workspace rows for the same model', () => {
    const usage = [
      { model: 'claude-a', workspace_id: 'ws-1', total_input_tokens: 200_000, total_output_tokens: 100_000, total_cache_creation_tokens: 0, total_cache_read_tokens: 0 },
      { model: 'claude-a', workspace_id: 'ws-2', total_input_tokens: 300_000, total_output_tokens: 150_000, total_cache_creation_tokens: 0, total_cache_read_tokens: 0 },
    ];
    const result = computeModelEfficiency(usage, [costRow('claude-a', 7.5)], 30);
    expect(result[0].totalTokens).toBe(750_000);
  });

  it('includes all token types (cache creation and read) in totalTokens', () => {
    const usage: UsageSummaryRow[] = [{
      model: 'claude-a',
      workspace_id: 'ws-1',
      total_input_tokens: 100_000,
      total_output_tokens: 100_000,
      total_cache_creation_tokens: 50_000,
      total_cache_read_tokens: 50_000,
    }];
    const result = computeModelEfficiency(usage, [costRow('claude-a', 3.0)], 30);
    expect(result[0].totalTokens).toBe(300_000);
  });

  it('ignores cost rows with null model', () => {
    const usage = [usageRow('claude-a', 100_000, 100_000)];
    const costs: CostByWorkspaceRow[] = [
      { workspace_id: 'ws-1', model: null, cost_type: 'platform', total_amount_usd: 999 },
      costRow('claude-a', 2.0),
    ];
    const result = computeModelEfficiency(usage, costs, 30);
    expect(result[0].totalCostUsd).toBeCloseTo(2.0, 4);
  });

  it('sets analysisWindowDays from the parameter', () => {
    const result = computeModelEfficiency([usageRow('claude-a', 100_000, 50_000)], [], 14);
    expect(result[0].analysisWindowDays).toBe(14);
  });
});
