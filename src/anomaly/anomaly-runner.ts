import { createModuleLogger } from '../utils/logger';
import { SupabaseReader } from '../storage/supabase-reader';
import { SupabaseWriter } from '../storage/supabase-writer';
import { TeamsAlerter } from './teams-alerter';
import { detectTokenSpike, defaultTokenSpikeConfig } from './token-spike-detector';
import { detectCostAnomaly, defaultCostAnomalyConfig } from './cost-anomaly-detector';
import { detectAgentLoop, defaultAgentLoopConfig } from './agent-loop-detector';
import type { AnomalyResult } from './types';

const logger = createModuleLogger('anomaly:runner');

export interface AnomalyRunnerOptions {
  lookbackDays?: number;
}

export class AnomalyRunner {
  constructor(
    private readonly reader: SupabaseReader,
    private readonly writer: SupabaseWriter,
    private readonly alerter: TeamsAlerter
  ) {}

  async run(options: AnomalyRunnerOptions = {}): Promise<AnomalyResult[]> {
    const days = options.lookbackDays ?? 8;

    logger.info({ days }, 'Starting anomaly detection run');

    const [dailyUsage, dailyCosts] = await Promise.all([
      this.reader.getDailyUsage(days),
      this.reader.getDailyCostSeries(days),
    ]);

    const tokenSpikeConfig = defaultTokenSpikeConfig();
    const costConfig = defaultCostAnomalyConfig();
    const loopConfig = defaultAgentLoopConfig();

    const candidates: Array<AnomalyResult | null> = [
      detectTokenSpike(dailyUsage, tokenSpikeConfig),
      detectCostAnomaly(dailyCosts, costConfig),
      detectAgentLoop(dailyUsage, loopConfig),
    ];

    const anomalies = candidates.filter((r): r is AnomalyResult => r !== null);

    logger.info({ total: candidates.length, detected: anomalies.length }, 'Anomaly detection complete');

    for (const anomaly of anomalies) {
      try {
        await this.alerter.send(anomaly);
        await this.writer.writeAlertLog(anomaly);
        logger.info({ type: anomaly.type, severity: anomaly.severity }, 'Alert fired and logged');
      } catch (err) {
        logger.error({ type: anomaly.type, err }, 'Failed to fire or log alert');
      }
    }

    return anomalies;
  }
}
