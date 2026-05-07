import pino from 'pino';

import { env } from '../config/env.js';

const logger = pino({
  level: env.logLevel,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
      singleLine: true,
    },
  },
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
});

export { logger };
