import { AlertError } from '../utils/error-handler';
import { createModuleLogger } from '../utils/logger';
import type { AnomalyResult } from './types';

const logger = createModuleLogger('anomaly:teams');

const THEME_COLOUR: Record<AnomalyResult['severity'], string> = {
  critical: 'FF0000',
  warning: 'FFA500',
};

export type FetchFn = typeof fetch;

function buildMessageCard(anomaly: AnomalyResult): object {
  const facts = Object.entries(anomaly.metadata).map(([name, value]) => ({
    name,
    value: String(value),
  }));

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: THEME_COLOUR[anomaly.severity],
    summary: `[${anomaly.severity.toUpperCase()}] ${anomaly.type}`,
    sections: [
      {
        activityTitle: `**[${anomaly.severity.toUpperCase()}] ${anomaly.type.replace(/_/g, ' ')}**`,
        activityText: anomaly.message,
        facts,
        markdown: true,
      },
    ],
  };
}

export class TeamsAlerter {
  constructor(
    private readonly webhookUrl: string,
    private readonly fetchFn: FetchFn = fetch
  ) {}

  async send(anomaly: AnomalyResult): Promise<void> {
    const payload = buildMessageCard(anomaly);

    let response: Response;
    try {
      response = await this.fetchFn(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logger.error({ type: anomaly.type, err }, 'Teams webhook request failed');
      throw new AlertError('Teams webhook request failed', { cause: err });
    }

    if (!response.ok) {
      logger.error({ status: response.status, type: anomaly.type }, 'Teams webhook returned non-OK status');
      throw new AlertError(`Teams webhook returned HTTP ${response.status}`);
    }

    logger.info({ type: anomaly.type, severity: anomaly.severity }, 'Teams alert sent');
  }
}
