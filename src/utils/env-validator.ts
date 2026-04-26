import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_ADMIN_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DASHBOARD_API_KEY: z.string().min(1),
  ALERT_WEBHOOK_URL: z.string().url(),
  COST_ALERT_THRESHOLD_USD: z.coerce.number().positive(),
  ENVIRONMENT: z.enum(['development', 'staging', 'production']),
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
