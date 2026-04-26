import { describe, it, expect } from 'vitest';
import {
  ApiError,
  StorageError,
  ValidationError,
  AlertError,
} from '../../src/utils/error-handler';

describe('ApiError', () => {
  it('has the correct name', () => {
    expect(new ApiError('fail').name).toBe('ApiError');
  });

  it('defaults to critical severity', () => {
    expect(new ApiError('fail').severity).toBe('critical');
  });

  it('accepts a custom severity', () => {
    expect(new ApiError('fail', { severity: 'warning' }).severity).toBe('warning');
  });

  it('stores the cause', () => {
    const cause = new Error('upstream');
    expect(new ApiError('fail', { cause }).cause).toBe(cause);
  });

  it('is an instance of Error', () => {
    expect(new ApiError('fail')).toBeInstanceOf(Error);
  });
});

describe('StorageError', () => {
  it('has the correct name', () => {
    expect(new StorageError('fail').name).toBe('StorageError');
  });

  it('defaults to critical severity', () => {
    expect(new StorageError('fail').severity).toBe('critical');
  });

  it('is an instance of Error', () => {
    expect(new StorageError('fail')).toBeInstanceOf(Error);
  });
});

describe('ValidationError', () => {
  it('has the correct name', () => {
    expect(new ValidationError('fail').name).toBe('ValidationError');
  });

  it('defaults to warning severity', () => {
    expect(new ValidationError('fail').severity).toBe('warning');
  });

  it('accepts a critical override', () => {
    expect(new ValidationError('fail', { severity: 'critical' }).severity).toBe('critical');
  });

  it('is an instance of Error', () => {
    expect(new ValidationError('fail')).toBeInstanceOf(Error);
  });
});

describe('AlertError', () => {
  it('has the correct name', () => {
    expect(new AlertError('fail').name).toBe('AlertError');
  });

  it('defaults to warning severity', () => {
    expect(new AlertError('fail').severity).toBe('warning');
  });

  it('is an instance of Error', () => {
    expect(new AlertError('fail')).toBeInstanceOf(Error);
  });
});
