export type Severity = 'warning' | 'critical';

interface ErrorOptions {
  cause?: unknown;
  severity?: Severity;
}

class AppError extends Error {
  readonly cause: unknown;
  readonly severity: Severity;

  constructor(message: string, defaultSeverity: Severity, options: ErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options.cause;
    this.severity = options.severity ?? defaultSeverity;
    // Restore prototype chain after extending Error in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApiError extends AppError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, 'critical', options);
  }
}

export class StorageError extends AppError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, 'critical', options);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, 'warning', options);
  }
}

export class AlertError extends AppError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, 'warning', options);
  }
}
