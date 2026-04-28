import { createModuleLogger } from '../utils/logger';
import type { UsageSummaryRow, CostByWorkspaceRow } from '../storage/supabase-reader';
import type { ModelEfficiency } from './types';

const logger = createModuleLogger('forecasting:efficiency');

export function computeModelEfficiency(
  usageSummary: UsageSummaryRow[],
  costByWorkspace: CostByWorkspaceRow[],
  analysisWindowDays: number
): ModelEfficiency[] {
  const tokensByModel = new Map<string, number>();
  for (const row of usageSummary) {
    const tokens =
      row.total_input_tokens +
      row.total_output_tokens +
      row.total_cache_creation_tokens +
      row.total_cache_read_tokens;
    tokensByModel.set(row.model, (tokensByModel.get(row.model) ?? 0) + tokens);
  }

  const costByModel = new Map<string, number>();
  for (const row of costByWorkspace) {
    if (row.model) {
      costByModel.set(row.model, (costByModel.get(row.model) ?? 0) + row.total_amount_usd);
    }
  }

  const results: ModelEfficiency[] = [];
  for (const [model, totalTokens] of tokensByModel) {
    const totalCostUsd = costByModel.get(model) ?? 0;
    const costPerMillionTokens =
      totalTokens > 0
        ? parseFloat(((totalCostUsd / totalTokens) * 1_000_000).toFixed(6))
        : 0;

    results.push({
      model,
      totalCostUsd: parseFloat(totalCostUsd.toFixed(6)),
      totalTokens,
      costPerMillionTokens,
      analysisWindowDays,
    });
  }

  // Most efficient (cheapest per token) first
  results.sort((a, b) => a.costPerMillionTokens - b.costPerMillionTokens);

  logger.info(
    { models: results.length, analysisWindowDays },
    'Model efficiency analysis complete'
  );

  return results;
}
