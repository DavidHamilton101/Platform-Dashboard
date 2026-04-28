export interface RegressionModel {
  slope: number;       // cost change per day
  intercept: number;   // baseline cost at day index 0
  r2: number;          // coefficient of determination (goodness of fit)
  dataPoints: number;
}

export type ScenarioName = 'low' | 'medium' | 'high';

export interface ForecastPoint {
  date: string;              // 'YYYY-MM-DD'
  predictedCostUsd: number;
}

export interface GrowthScenario {
  scenario: ScenarioName;
  annualGrowthRate: number;  // e.g. 0.15 = 15% annual growth
  points: ForecastPoint[];
}

export interface ModelEfficiency {
  model: string;
  totalCostUsd: number;
  totalTokens: number;
  costPerMillionTokens: number;
  analysisWindowDays: number;
}

export interface ForecastRun {
  runId: string;
  generatedAt: string;
  historyDays: number;
  horizonDays: number;
  regression: RegressionModel;
  scenarios: GrowthScenario[];
  modelEfficiency: ModelEfficiency[];
}
