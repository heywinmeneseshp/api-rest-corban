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
    // Sequelize reemplaza `.stack` con uno genérico (siempre "Error", sin
    // texto real) cuando reenvía errores de MySQL — si solo mostráramos
    // `stack || message` (como antes), el mensaje real quedaba oculto.
    // Mostrar siempre el mensaje primero y el stack como detalle aparte.
    const detalle = stack && stack !== `Error` && !stack.startsWith('Error\n') ? `\n${stack}` : '';
    return `[${ts}] ${level}: ${message}${detalle}${metaStr}`;
  }),
);

// En Vercel el filesystem es de solo lectura (salvo /tmp): no se pueden
// escribir logs a archivo ahí, así que en ese entorno solo se usa consola
// (Vercel captura stdout/stderr y los muestra en su propio dashboard).
const isServerless = Boolean(process.env.VERCEL);

export const logger = winston.createLogger({
  level: env.isProduction ? 'info' : 'debug',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: isServerless
    ? []
    : [
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join(logsDir, 'combined.log'),
        }),
      ],
});

logger.add(
  new winston.transports.Console({
    format: consoleFormat,
  }),
);

export default logger;
