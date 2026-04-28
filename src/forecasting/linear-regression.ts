import { createModuleLogger } from '../utils/logger';
import type { RegressionModel } from './types';

const logger = createModuleLogger('forecasting:regression');

export interface DataPoint {
  x: number; // day index (0-based)
  y: number; // cost in USD
}

export function buildDataPoints(dailyCosts: Array<{ day: string; total_amount_usd: number }>): DataPoint[] {
  const sorted = [...dailyCosts].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((row, i) => ({ x: i, y: row.total_amount_usd }));
}

export function fitLinearRegression(points: DataPoint[]): RegressionModel {
  const n = points.length;
  if (n < 2) {
    throw new Error(`Linear regression requires at least 2 data points, got ${n}`);
  }

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - meanY, 2), 0);
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (intercept + slope * p.x), 2), 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 1;

  logger.info({ slope, intercept, r2, dataPoints: n }, 'Regression model fitted');

  return {
    slope: parseFloat(slope.toFixed(8)),
    intercept: parseFloat(intercept.toFixed(8)),
    r2: parseFloat(r2.toFixed(6)),
    dataPoints: n,
  };
}

export function predict(model: RegressionModel, x: number): number {
  return Math.max(0, model.intercept + model.slope * x);
}
