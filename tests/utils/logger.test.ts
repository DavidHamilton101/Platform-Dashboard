import { describe, it, expect } from 'vitest';
import { logger, createModuleLogger } from '../../src/utils/logger';

describe('logger', () => {
  it('exposes standard pino log methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('has a level property', () => {
    expect(typeof logger.level).toBe('string');
  });
});

describe('createModuleLogger', () => {
  it('returns a child logger', () => {
    const mod = createModuleLogger('test-module');
    expect(typeof mod.info).toBe('function');
    expect(typeof mod.error).toBe('function');
  });

  it('returns a different instance for different module names', () => {
    const a = createModuleLogger('module-a');
    const b = createModuleLogger('module-b');
    expect(a).not.toBe(b);
  });
});
