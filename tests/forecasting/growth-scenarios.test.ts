import { describe, it, expect } from 'vitest';
import { generateScenarios } from '../../src/forecasting/growth-scenarios';
import type { ScenarioConfig } from '../../src/forecasting/growth-scenarios';
import type { RegressionModel } from '../../src/forecasting/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const flatRegression: RegressionModel = {
  slope: 0,
  intercept: 100,
  r2: 1,
  dataPoints: 30,
};

const config: ScenarioConfig = { low: 0.05, medium: 0.15, high: 0.30 };
const fixedDate = new Date('2026-04-28T00:00:00Z');

// ─── generateScenarios ────────────────────────────────────────────────────────

describe('generateScenarios', () => {
  it('returns exactly three scenarios: low, medium, high', () => {
    const result = generateScenarios(flatRegression, 30, 10, config, fixedDate);
    expect(result.map(s => s.scenario)).toEqual(['low', 'medium', 'high']);
  });

  it('each scenario has the correct number of forecast points', () => {
    const result = generateScenarios(flatRegression, 30, 14, config, fixedDate);
    for (const scenario of result) {
      expect(scenario.points).toHaveLength(14);
    }
  });

  it('dates start at fromDate + 1 day and are in ascending order', () => {
    const result = generateScenarios(flatRegression, 30, 3, config, fixedDate);
    const dates = result[0].points.map(p => p.date);
    expect(dates).toEqual(['2026-04-29', '2026-04-30', '2026-05-01']);
  });

  it('high scenario predicts more cost than medium, which predicts more than low', () => {
    const result = generateScenarios(flatRegression, 30, 30, config, fixedDate);
    const [low, medium, high] = result.map(s => s.points[29].predictedCostUsd);
    expect(high).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(low);
  });

  it('all scenarios converge to the same baseline when growth rates are all 0', () => {
    const zeroConfig: ScenarioConfig = { low: 0, medium: 0, high: 0 };
    const result = generateScenarios(flatRegression, 30, 5, zeroConfig, fixedDate);
    const values = result.map(s => s.points[4].predictedCostUsd);
    expect(values[0]).toBeCloseTo(values[1], 4);
    expect(values[1]).toBeCloseTo(values[2], 4);
  });

  it('stores the correct annualGrowthRate on each scenario', () => {
    const result = generateScenarios(flatRegression, 30, 1, config, fixedDate);
    expect(result.find(s => s.scenario === 'low')?.annualGrowthRate).toBe(0.05);
    expect(result.find(s => s.scenario === 'medium')?.annualGrowthRate).toBe(0.15);
    expect(result.find(s => s.scenario === 'high')?.annualGrowthRate).toBe(0.30);
  });

  it('predicted cost is never negative even for a strongly negative regression', () => {
    const decliningRegression: RegressionModel = { slope: -50, intercept: 10, r2: 0.9, dataPoints: 10 };
    const result = generateScenarios(decliningRegression, 10, 30, config, fixedDate);
    for (const scenario of result) {
      for (const point of scenario.points) {
        expect(point.predictedCostUsd).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
