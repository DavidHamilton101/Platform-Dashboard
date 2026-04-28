import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_ADMIN_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DASHBOARD_API_KEY: z.string().min(1),
  ALERT_WEBHOOK_URL: z.string().url(),
  COST_ALERT_THRESHOLD_USD: z.coerce.number().positive(),
  ENVIRONMENT: z.enum(['development', 'staging', 'production']),
  // Forecasting parameters — all optional with safe defaults
  FORECAST_HISTORY_DAYS: z.coerce.number().int().positive().default(30),
  FORECAST_HORIZON_DAYS: z.coerce.number().int().positive().default(90),
  GROWTH_SCENARIO_LOW: z.coerce.number().positive().default(0.05),
  GROWTH_SCENARIO_MEDIUM: z.coerce.number().positive().default(0.15),
  GROWTH_SCENARIO_HIGH: z.coerce.number().positive().default(0.30),
  // Anomaly detection thresholds — all optional with safe defaults
  TOKEN_SPIKE_WINDOW_DAYS: z.coerce.number().positive().default(7),
  TOKEN_SPIKE_MULTIPLIER: z.coerce.number().positive().default(3),
  TOKEN_SPIKE_THRESHOLD: z.coerce.number().positive().default(1_000_000),
  COST_SPIKE_MULTIPLIER: z.coerce.number().positive().default(3),
  AGENT_LOOP_TOKEN_THRESHOLD: z.coerce.number().positive().default(500_000),
  AGENT_LOOP_RATIO_THRESHOLD: z.coerce.number().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates all required environment variables on startup.
 * Throws with the names of missing/invalid variables — never their values.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const invalid = result.error.issues
      .map((issue) => issue.path.join('.'))
      .join(', ');
    throw new Error(
      `Environment validation failed. Missing or invalid: ${invalid}`
    );
  }

  return result.data;
}
