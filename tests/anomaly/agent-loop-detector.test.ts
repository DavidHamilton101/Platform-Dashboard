import { describe, it, expect } from 'vitest';
import type { DailyUsageRow } from '../../src/storage/supabase-reader';
import { detectAgentLoop } from '../../src/anomaly/agent-loop-detector';
import type { AgentLoopConfig } from '../../src/anomaly/agent-loop-detector';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const config: AgentLoopConfig = {
  tokenThreshold: 500_000,
  outputInputRatioThreshold: 10,
};

function makeRow(overrides: Partial<DailyUsageRow> = {}): DailyUsageRow {
  return {
    recorded_at: '2026-04-28T00:00:00Z',
    model: 'claude-3-5-sonnet-20241022',
    workspace_id: 'ws-1',
    input_tokens: 10_000,
    output_tokens: 5_000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    ...overrides,
  };
}

// ─── detectAgentLoop ─────────────────────────────────────────────────────────

describe('detectAgentLoop', () => {
  it('returns null for empty rows', () => {
    expect(detectAgentLoop([], config)).toBeNull();
  });

  it('returns null when all rows are within normal bounds', () => {
    const rows = [
      makeRow({ input_tokens: 100_000, output_tokens: 50_000 }),
      makeRow({ input_tokens: 80_000, output_tokens: 40_000 }),
    ];
    expect(detectAgentLoop(rows, config)).toBeNull();
  });

  it('returns critical when total tokens exceed token threshold', () => {
    const rows = [
      makeRow({ input_tokens: 300_000, output_tokens: 250_000 }), // 550_000 total
    ];
    const result = detectAgentLoop(rows, config);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('agent_loop');
    expect(result?.severity).toBe('critical');
    expect(result?.message).toContain('550,000');
  });

  it('returns warning when output/input ratio exceeds ratio threshold', () => {
    const rows = [
      makeRow({ input_tokens: 5_000, output_tokens: 60_000 }), // ratio = 12
    ];
    const result = detectAgentLoop(rows, config);
    expect(result?.severity).toBe('warning');
    expect(result?.message).toContain('ratio');
  });

  it('includes model and workspace_id in metadata', () => {
    const rows = [
      makeRow({ input_tokens: 300_000, output_tokens: 250_000, workspace_id: 'ws-test' }),
    ];
    const result = detectAgentLoop(rows, config);
    expect(result?.metadata.workspace_id).toBe('ws-test');
    expect(result?.metadata.model).toBe('claude-3-5-sonnet-20241022');
  });

  it('prioritises token threshold check over ratio check', () => {
    // Row exceeds both — should report critical (token threshold) not warning (ratio)
    const rows = [
      makeRow({ input_tokens: 10_000, output_tokens: 500_000 }), // total > 500_000 AND ratio > 10
    ];
    const result = detectAgentLoop(rows, config);
    expect(result?.severity).toBe('critical');
  });

  it('returns null when input is zero and output is zero', () => {
    const rows = [makeRow({ input_tokens: 0, output_tokens: 0 })];
    expect(detectAgentLoop(rows, config)).toBeNull();
  });

  it('returns null when input is zero but output is below token threshold', () => {
    // ratio would be infinity but we guard against input === 0 with ratio = 0
    const rows = [makeRow({ input_tokens: 0, output_tokens: 100_000 })];
    expect(detectAgentLoop(rows, config)).toBeNull();
  });

  it('flags the first offending row when multiple rows are present', () => {
    const rows = [
      makeRow({ recorded_at: '2026-04-27T00:00:00Z', input_tokens: 10_000, output_tokens: 5_000 }),
      makeRow({ recorded_at: '2026-04-28T00:00:00Z', input_tokens: 300_000, output_tokens: 250_000 }),
    ];
    const result = detectAgentLoop(rows, config);
    expect(result?.metadata.recorded_at).toBe('2026-04-28T00:00:00Z');
  });

  it('includes cache tokens in total token count for threshold check', () => {
    const rows = [
      makeRow({
        input_tokens: 100_000,
        output_tokens: 100_000,
        cache_creation_input_tokens: 150_000,
        cache_read_input_tokens: 160_000, // total = 510_000
      }),
    ];
    const result = detectAgentLoop(rows, config);
    expect(result?.severity).toBe('critical');
  });
});
