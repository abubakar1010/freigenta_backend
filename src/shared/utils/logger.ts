import pino from 'pino';

/**
 * Structured logger using pino.
 *
 * - In production: outputs newline-delimited JSON (machine parseable by Datadog, Splunk, etc.)
 * - In development: pretty-prints with colour via pino-pretty
 *
 * Every log line in this codebase should use this logger rather than
 * console.log / console.error so that log level, correlation IDs,
 * and timestamps are always consistent.
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  // Redact sensitive fields from all log lines automatically
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.passwordHash',
      'body.bvn',
      'body.nin',
    ],
    censor: '[REDACTED]',
  },
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});
