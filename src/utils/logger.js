import winston from 'winston';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.resolve(__dirname, '../../logs');

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level}: ${stack || message}${metaStr}`;
  }),
);

export const logger = winston.createLogger({
  level: env.isProduction ? 'info' : 'debug',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
  ],
});

if (!env.isProduction) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}

export default logger;
