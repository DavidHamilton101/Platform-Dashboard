import pino from 'pino';

const isProduction = process.env.ENVIRONMENT === 'production';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  ...(!isProduction && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  timestamp: pino.stdTimeFunctions.isoTime,
  // Prevent credentials from appearing in log output
  redact: {
    paths: [
      'apiKey',
      'api_key',
      'key',
      'token',
      'secret',
      'password',
      'authorization',
      'Authorization',
      '*.apiKey',
      '*.api_key',
      '*.token',
      '*.secret',
    ],
    censor: '[REDACTED]',
  },
});

export function createModuleLogger(module: string): pino.Logger {
  return logger.child({ module });
}
