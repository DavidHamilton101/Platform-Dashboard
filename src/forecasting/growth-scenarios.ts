import { createModuleLogger } from '../utils/logger';
import { predict } from './linear-regression';
import type { RegressionModel, GrowthScenario, ForecastPoint, ScenarioName } from './types';

const logger = createModuleLogger('forecasting:scenarios');

export interface ScenarioConfig {
  low: number;    // annualised growth rate, e.g. 0.05 = 5%
  medium: number;
  high: number;
}

export function defaultScenarioConfig(): ScenarioConfig {
  return {
    low: Number(process.env.GROWTH_SCENARIO_LOW ?? 0.05),
    medium: Number(process.env.GROWTH_SCENARIO_MEDIUM ?? 0.15),
    high: Number(process.env.GROWTH_SCENARIO_HIGH ?? 0.30),
  };
}

export function generateScenarios(
  regression: RegressionModel,
  historyDays: number,
  horizonDays: number,
  config: ScenarioConfig,
  fromDate: Date = new Date()
): GrowthScenario[] {
  const scenarioNames: ScenarioName[] = ['low', 'medium', 'high'];

  const scenarios = scenarioNames.map((scenario) => {
    const annualGrowthRate = config[scenario];
    const points: ForecastPoint[] = [];

    for (let d = 1; d <= horizonDays; d++) {
      const x = historyDays + d;
      const baseline = predict(regression, x);
      // Compound the annualised growth rate over d days
      const growthMultiplier = Math.pow(1 + annualGrowthRate, d / 365);
      const predictedCostUsd = parseFloat((baseline * growthMultiplier).toFixed(6));

      const date = new Date(fromDate.getTime() + d * 24 * 60 * 60 * 1_000);
      points.push({ date: date.toISOString().slice(0, 10), predictedCostUsd });
    }

    return { scenario, annualGrowthRate, points };
  });

  logger.info(
    { horizonDays, scenarios: scenarioNames, historyDays },
    'Growth scenarios generated'
  );

  return scenarios;
}
