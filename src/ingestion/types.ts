// Anthropic Admin API — Usage Report

export interface UsageReportParams {
  start_time: string;   // ISO 8601
  end_time: string;     // ISO 8601
  bucket_width: '1d' | '1h';
  workspace_id?: string;
  model?: string;
  limit?: number;
  after_id?: string;    // pagination cursor
}

export interface UsageBucket {
  timestamp: string;
  organization_id: string;
  workspace_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface UsageReportResponse {
  object: 'list';
  data: UsageBucket[];
  has_more: boolean;
  first_id: string | null;
  last_id: string | null;
}

// Anthropic Admin API — Cost Report

export interface CostReportParams {
  start_time: string;
  end_time: string;
  workspace_id?: string;
  limit?: number;
  after_id?: string;
}

export interface CostAmount {
  value: number;
  currency: string;
}

export interface CostRecord {
  timestamp: string;
  organization_id: string;
  workspace_id: string | null;
  description: string;
  amount: CostAmount;
}

export interface CostReportResponse {
  object: 'list';
  data: CostRecord[];
  has_more: boolean;
  first_id: string | null;
  last_id: string | null;
}

// Enriched record with parsed model/feature fields

export interface ParsedCostRecord extends CostRecord {
  model: string | null;
  feature: string | null;
}

// Ingestion scheduling

export type IngestionType = 'usage' | 'costs';
