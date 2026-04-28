import { describe, it, expect } from 'vitest';
import { fitLinearRegression, predict, buildDataPoints } from '../../src/forecasting/linear-regression';

// ─── buildDataPoints ──────────────────────────────────────────────────────────

describe('buildDataPoints', () => {
  it('converts sorted daily cost rows to indexed data points', () => {
    const rows = [
      { day: '2026-04-21', total_amount_usd: 10 },
      { day: '2026-04-22', total_amount_usd: 12 },
      { day: '2026-04-23', total_amount_usd: 11 },
    ];
    const points = buildDataPoints(rows);
    expect(points).toEqual([
      { x: 0, y: 10 },
      { x: 1, y: 12 },
      { x: 2, y: 11 },
    ]);
  });

  it('sorts input rows by day before indexing', () => {
    const rows = [
      { day: '2026-04-23', total_amount_usd: 11 },
      { day: '2026-04-21', total_amount_usd: 10 },
      { day: '2026-04-22', total_amount_usd: 12 },
    ];
    const points = buildDataPoints(rows);
    expect(points[0]).toEqual({ x: 0, y: 10 });
    expect(points[2]).toEqual({ x: 2, y: 11 });
  });

  it('returns an empty array for empty input', () => {
    expect(buildDataPoints([])).toEqual([]);
  });
});

// ─── fitLinearRegression ──────────────────────────────────────────────────────

describe('fitLinearRegression', () => {
  it('throws when fewer than 2 points are provided', () => {
    expect(() => fitLinearRegression([{ x: 0, y: 10 }])).toThrow();
    expect(() => fitLinearRegression([])).toThrow();
  });

  it('fits a perfect upward trend', () => {
    // y = 2x + 5  →  slope ≈ 2, intercept ≈ 5, R² = 1
    const points = [0, 1, 2, 3, 4].map(x => ({ x, y: 2 * x + 5 }));
    const model = fitLinearRegression(points);
    expect(model.slope).toBeCloseTo(2, 5);
    expect(model.intercept).toBeCloseTo(5, 5);
    expect(model.r2).toBeCloseTo(1, 4);
    expect(model.dataPoints).toBe(5);
  });

  it('fits a perfect downward trend', () => {
    const points = [0, 1, 2, 3].map(x => ({ x, y: 10 - x }));
    const model = fitLinearRegression(points);
    expect(model.slope).toBeCloseTo(-1, 5);
    expect(model.r2).toBeCloseTo(1, 4);
  });

  it('returns R² close to 0 for random noise around a flat mean', () => {
    const points = [
      { x: 0, y: 5 }, { x: 1, y: 15 }, { x: 2, y: 5 }, { x: 3, y: 15 },
    ];
    const model = fitLinearRegression(points);
    expect(model.r2).toBeGreaterThanOrEqual(0);
    expect(model.r2).toBeLessThan(0.5);
  });

  it('handles two points exactly', () => {
    const model = fitLinearRegression([{ x: 0, y: 10 }, { x: 1, y: 20 }]);
    expect(model.slope).toBeCloseTo(10, 5);
    expect(model.r2).toBeCloseTo(1, 4);
  });

  it('returns R² = 1 when all y values are identical (no variance)', () => {
    const points = [0, 1, 2, 3].map(x => ({ x, y: 7 }));
    const model = fitLinearRegression(points);
    expect(model.r2).toBe(1);
  });
});

// ─── predict ─────────────────────────────────────────────────────────────────

describe('predict', () => {
  it('returns intercept + slope * x', () => {
    const model = { slope: 2, intercept: 5, r2: 1, dataPoints: 5 };
    expect(predict(model, 3)).toBeCloseTo(11, 5);
  });

  it('clamps negative predictions to 0', () => {
    const model = { slope: -10, intercept: 5, r2: 0.9, dataPoints: 3 };
    expect(predict(model, 10)).toBe(0); // 5 - 100 = -95 → clamped
  });
});
