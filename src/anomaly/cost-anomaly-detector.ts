import type { DailyCostSeriesRow } from '../storage/supabase-reader';
import { createModuleLogger } from '../utils/logger';
import type { AnomalyResult } from './types';

const logger = createModuleLogger('anomaly:cost');

export interface CostAnomalyConfig {
  windowDays: number;
  multiplier: number;
  dailyThresholdUsd: number;
  totalThresholdUsd: number;
}

export function defaultCostAnomalyConfig(): CostAnomalyConfig {
  return {
    windowDays: Number(process.env.TOKEN_SPIKE_WINDOW_DAYS ?? 7),
    multiplier: Number(process.env.COST_SPIKE_MULTIPLIER ?? 3),
    dailyThresholdUsd: Number(process.env.COST_ALERT_THRESHOLD_USD ?? 100),
    totalThresholdUsd: Number(process.env.COST_ALERT_THRESHOLD_USD ?? 100) * 7,
  };
}

export function detectCostAnomaly(
  rows: DailyCostSeriesRow[],
  config: CostAnomalyConfig
): AnomalyResult | null {
  if (rows.length < 2) return null;

  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const today = sorted[sorted.length - 1];
  const prior = sorted.slice(0, -1);
  const baseline =
    prior.reduce((sum, r) => sum + r.total_amount_usd, 0) / prior.length;
  const periodTotal = sorted.reduce((sum, r) => sum + r.total_amount_usd, 0);

  const spikeByMultiplier = baseline > 0 && today.total_amount_usd > baseline * config.multiplier;
  const spikeByDaily = today.total_amount_usd > config.dailyThresholdUsd;
  const spikeByTotal = periodTotal > config.totalThresholdUsd;

  if (!spikeByMultiplier && !spikeByDaily && !spikeByTotal) return null;

  let reason: string;
  let severity: AnomalyResult['severity'];

  if (spikeByDaily) {
    reason = `daily spend ($${today.total_amount_usd.toFixed(2)}) exceeded threshold of $${config.dailyThresholdUsd.toFixed(2)}`;
    severity = 'critical';
  } else if (spikeByTotal) {
    reason = `period total ($${periodTotal.toFixed(2)}) exceeded threshold of $${config.totalThresholdUsd.toFixed(2)}`;
    severity = 'critical';
  } else {
    reason = `daily spend ($${today.total_amount_usd.toFixed(2)}) is ${(today.total_amount_usd / baseline).toFixed(1)}x the ${prior.length}-day average ($${baseline.toFixed(2)})`;
    severity = 'warning';
  }

  logger.warn(
    { day: today.day, dailyCost: today.total_amount_usd, baseline, periodTotal, reason },
    'Cost anomaly detected'
  );

  return {
    type: 'cost_anomaly',
    severity,
    message: `Cost anomaly detected: ${reason}`,
    metadata: {
      day: today.day,
      dailyCostUsd: today.total_amount_usd,
      baselineUsd: parseFloat(baseline.toFixed(4)),
      periodTotalUsd: parseFloat(periodTotal.toFixed(4)),
      multiplierThreshold: config.multiplier,
      dailyThresholdUsd: config.dailyThresholdUsd,
    },
    detectedAt: new Date().toISOString(),
  };
}
