import { randomUUID } from 'crypto';
import { createModuleLogger } from '../utils/logger';
import { SupabaseReader } from '../storage/supabase-reader';
import { SupabaseWriter } from '../storage/supabase-writer';
import { buildDataPoints, fitLinearRegression } from './linear-regression';
import { generateScenarios, defaultScenarioConfig } from './growth-scenarios';
import { computeModelEfficiency } from './model-efficiency';
import type { ForecastRun } from './types';

const logger = createModuleLogger('forecasting:runner');

export interface ForecastRunnerOptions {
  historyDays?: number;
  horizonDays?: number;
}

export class ForecastRunner {
  constructor(
    private readonly reader: SupabaseReader,
    private readonly writer: SupabaseWriter
  ) {}

  async run(options: ForecastRunnerOptions = {}): Promise<ForecastRun> {
    const historyDays = options.historyDays ?? Number(process.env.FORECAST_HISTORY_DAYS ?? 30);
    const horizonDays = options.horizonDays ?? Number(process.env.FORECAST_HORIZON_DAYS ?? 90);
    const runId = randomUUID();
    const generatedAt = new Date().toISOString();

    logger.info({ runId, historyDays, horizonDays }, 'Starting forecast run');

    const [dailyCosts, usageSummary, costByWorkspace] = await Promise.all([
      this.reader.getDailyCostSeries(historyDays),
      this.reader.getUsageSummary(historyDays),
      this.reader.getCostByWorkspace(historyDays),
    ]);

    if (dailyCosts.length < 2) {
      logger.warn({ runId, dataPoints: dailyCosts.length }, 'Insufficient cost history for regression — need at least 2 days');
    }

    const dataPoints = buildDataPoints(dailyCosts);
    const regression =
      dataPoints.length >= 2
        ? fitLinearRegression(dataPoints)
        : { slope: 0, intercept: 0, r2: 0, dataPoints: dataPoints.length };

    const scenarioConfig = defaultScenarioConfig();
    const scenarios = generateScenarios(
      regression,
      dataPoints.length,
      horizonDays,
      scenarioConfig
    );

    const modelEfficiency = computeModelEfficiency(usageSummary, costByWorkspace, historyDays);

    await Promise.all([
      this.writer.writeForecastResults(runId, generatedAt, horizonDays, scenarios),
      this.writer.writeModelEfficiencySnapshot(modelEfficiency),
    ]);

    const result: ForecastRun = {
      runId,
      generatedAt,
      historyDays,
      horizonDays,
      regression,
      scenarios,
      modelEfficiency,
    };

    logger.info(
      { runId, scenarios: scenarios.length, modelEfficiency: modelEfficiency.length },
      'Forecast run complete'
    );

    return result;
  }
}
