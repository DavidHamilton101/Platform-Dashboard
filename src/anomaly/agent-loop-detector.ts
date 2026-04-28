import type { DailyUsageRow } from '../storage/supabase-reader';
import { createModuleLogger } from '../utils/logger';
import type { AnomalyResult } from './types';

const logger = createModuleLogger('anomaly:agent-loop');

export interface AgentLoopConfig {
  // Tokens in a single bucket that suggest a runaway loop
  tokenThreshold: number;
  // output_tokens / input_tokens ratio that suggests a loop (lots of generation, little input)
  outputInputRatioThreshold: number;
}

export function defaultAgentLoopConfig(): AgentLoopConfig {
  return {
    tokenThreshold: Number(process.env.AGENT_LOOP_TOKEN_THRESHOLD ?? 500_000),
    outputInputRatioThreshold: Number(process.env.AGENT_LOOP_RATIO_THRESHOLD ?? 10),
  };
}

export function detectAgentLoop(
  rows: DailyUsageRow[],
  config: AgentLoopConfig
): AnomalyResult | null {
  for (const row of rows) {
    const totalTokens =
      row.input_tokens +
      row.output_tokens +
      row.cache_creation_input_tokens +
      row.cache_read_input_tokens;

    if (totalTokens > config.tokenThreshold) {
      logger.warn(
        { recorded_at: row.recorded_at, model: row.model, totalTokens },
        'Agent loop detected: token threshold exceeded'
      );
      return {
        type: 'agent_loop',
        severity: 'critical',
        message: `Agent loop suspected: ${totalTokens.toLocaleString()} tokens in a single period for model ${row.model}`,
        metadata: {
          recorded_at: row.recorded_at,
          model: row.model,
          workspace_id: row.workspace_id,
          totalTokens,
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          tokenThreshold: config.tokenThreshold,
        },
        detectedAt: new Date().toISOString(),
      };
    }

    const ratio =
      row.input_tokens > 0 ? row.output_tokens / row.input_tokens : 0;

    if (ratio > config.outputInputRatioThreshold) {
      logger.warn(
        { recorded_at: row.recorded_at, model: row.model, ratio },
        'Agent loop detected: output/input ratio exceeded'
      );
      return {
        type: 'agent_loop',
        severity: 'warning',
        message: `Agent loop suspected: output/input token ratio of ${ratio.toFixed(1)} for model ${row.model}`,
        metadata: {
          recorded_at: row.recorded_at,
          model: row.model,
          workspace_id: row.workspace_id,
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          ratio: parseFloat(ratio.toFixed(2)),
          ratioThreshold: config.outputInputRatioThreshold,
        },
        detectedAt: new Date().toISOString(),
      };
    }
  }

  return null;
}
