export type AnomalyType = 'token_spike' | 'cost_anomaly' | 'agent_loop';
export type AlertSeverity = 'warning' | 'critical';

export interface AnomalyResult {
  type: AnomalyType;
  severity: AlertSeverity;
  message: string;
  metadata: Record<string, unknown>;
  detectedAt: string;
}
