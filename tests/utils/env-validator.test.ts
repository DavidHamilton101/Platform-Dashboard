import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnv } from '../../src/utils/env-validator';

const VALID_ENV = {
  ANTHROPIC_ADMIN_API_KEY: 'sk-ant-admin-test',
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DASHBOARD_API_KEY: 'test-dashboard-key',
  ALERT_WEBHOOK_URL: 'https://hooks.slack.com/test',
  COST_ALERT_THRESHOLD_USD: '100',
  ENVIRONMENT: 'development',
};

describe('validateEnv', () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = { ...process.env };
    // Clear only the vars we manage so other env vars don't interfere
    Object.keys(VALID_ENV).forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    Object.keys(VALID_ENV).forEach((k) => delete process.env[k]);
    Object.assign(process.env, original);
  });

  it('returns parsed env when all variables are valid', () => {
    Object.assign(process.env, VALID_ENV);
    const env = validateEnv();
    expect(env.ENVIRONMENT).toBe('development');
    expect(env.COST_ALERT_THRESHOLD_USD).toBe(100);
  });

  it('coerces COST_ALERT_THRESHOLD_USD to a number', () => {
    Object.assign(process.env, VALID_ENV);
    const env = validateEnv();
    expect(typeof env.COST_ALERT_THRESHOLD_USD).toBe('number');
  });

  it('throws when a required variable is missing', () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.ANTHROPIC_ADMIN_API_KEY;
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('includes the name of the missing variable in the error', () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.DASHBOARD_API_KEY;
    expect(() => validateEnv()).toThrow('DASHBOARD_API_KEY');
  });

  it('does not include variable values in the error message', () => {
    Object.assign(process.env, VALID_ENV);
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      validateEnv();
    } catch (err) {
      const message = (err as Error).message;
      // The error must never contain the value of any env var
      Object.values(VALID_ENV).forEach((value) => {
        expect(message).not.toContain(value);
      });
    }
  });

  it('throws when SUPABASE_URL is not a valid URL', () => {
    Object.assign(process.env, { ...VALID_ENV, SUPABASE_URL: 'not-a-url' });
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('throws when ENVIRONMENT is not a recognised value', () => {
    Object.assign(process.env, { ...VALID_ENV, ENVIRONMENT: 'local' });
    expect(() => validateEnv()).toThrow('Environment validation failed');
  });

  it('accepts all three valid ENVIRONMENT values', () => {
    for (const env of ['development', 'staging', 'production'] as const) {
      Object.assign(process.env, { ...VALID_ENV, ENVIRONMENT: env });
      expect(() => validateEnv()).not.toThrow();
    }
  });
});
