import type { DailyUsageRow } from '../storage/supabase-reader';
import { createModuleLogger } from '../utils/logger';
import type { AnomalyResult } from './types';

const logger = createModuleLogger('anomaly:token-spike');

export interface TokenSpikeConfig {
  windowDays: number;
  multiplier: number;
  absoluteThreshold: number;
}

export function defaultTokenSpikeConfig(): TokenSpikeConfig {
  return {
    windowDays: Number(process.env.TOKEN_SPIKE_WINDOW_DAYS ?? 7),
    multiplier: Number(process.env.TOKEN_SPIKE_MULTIPLIER ?? 3),
    absoluteThreshold: Number(process.env.TOKEN_SPIKE_THRESHOLD ?? 1_000_000),
  };
}

export function detectTokenSpike(
  rows: DailyUsageRow[],
  config: TokenSpikeConfig
): AnomalyResult | null {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.recorded_at.slice(0, 10);
    const tokens =
      row.input_tokens +
      row.output_tokens +
      row.cache_creation_input_tokens +
      row.cache_read_input_tokens;
    byDay.set(day, (byDay.get(day) ?? 0) + tokens);
  }

  if (byDay.size < 2) return null;

  const sortedDays = Array.from(byDay.keys()).sort();
  const today = sortedDays[sortedDays.length - 1];
  const todayTokens = byDay.get(today) ?? 0;
  const priorDays = sortedDays.slice(0, -1);
  const baseline =
    priorDays.reduce((sum, d) => sum + (byDay.get(d) ?? 0), 0) / priorDays.length;

  const spikeByMultiplier = baseline > 0 && todayTokens > baseline * config.multiplier;
  const spikeByAbsolute = todayTokens > config.absoluteThreshold;

  if (!spikeByMultiplier && !spikeByAbsolute) return null;

  const reason = spikeByAbsolute
    ? `total tokens (${todayTokens.toLocaleString()}) exceeded threshold of ${config.absoluteThreshold.toLocaleString()}`
    : `total tokens (${todayTokens.toLocaleString()}) are ${(todayTokens / baseline).toFixed(1)}x the ${priorDays.length}-day average`;

  logger.warn({ today, todayTokens, baseline, reason }, 'Token spike detected');

  return {
    type: 'token_spike',
    severity: spikeByAbsolute ? 'critical' : 'warning',
    message: `Token spike detected: ${reason}`,
    metadata: {
      today,
      todayTokens,
      baseline: Math.round(baseline),
      multiplierThreshold: config.multiplier,
      absoluteThreshold: config.absoluteThreshold,
    },
    detectedAt: new Date().toISOString(),
  };
}
