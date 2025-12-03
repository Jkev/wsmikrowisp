import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Crear carpeta de logs si no existe
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    const msg = stack || message;
    return `[${timestamp}] ${level.toUpperCase()}: ${msg}`;
  })
);

// Logger principal
export const logger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    // Archivo de logs generales
    new winston.transports.File({
      filename: path.join(logsDir, 'scraper.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Archivo de errores
    new winston.transports.File({
      filename: path.join(logsDir, 'errors.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    // Consola
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${level}: ${message}`;
        })
      )
    })
  ]
});

// Logger específico para ejecuciones
export function createRunLogger(runId) {
  const runLogPath = path.join(logsDir, `run-${runId}.log`);

  return winston.createLogger({
    level: 'debug',
    format: customFormat,
    transports: [
      new winston.transports.File({ filename: runLogPath }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message }) => `${level}: ${message}`)
        )
      })
    ]
  });
}

export default logger;
