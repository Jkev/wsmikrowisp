import { format, subDays } from 'date-fns';
import fs from 'fs';
import path from 'path';

/**
 * Obtiene la fecha del día anterior en formato YYYY-MM-DD
 */
export function getYesterdayDate() {
  const yesterday = subDays(new Date(), 1);
  return format(yesterday, 'yyyy-MM-dd');
}

/**
 * Obtiene la fecha del día anterior en formato DD/MM/YYYY (para MikroWISP)
 */
export function getYesterdayDateFormatted() {
  const yesterday = subDays(new Date(), 1);
  return format(yesterday, 'dd/MM/yyyy');
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD
 */
export function getTodayDate() {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Crea una carpeta con el nombre y fecha especificados
 * Formato: YYYY-MM-DD
 */
export function createDownloadFolder(baseDir = './downloads') {
  const folderName = format(new Date(), 'yyyy-MM-dd');
  const folderPath = path.join(baseDir, folderName);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  return folderPath;
}

/**
 * Genera el nombre de archivo para un PDF de factura
 * Formato: YYYY-MM-DD_{idCliente}_{nombreCliente}_{numFactura}.pdf
 */
export function generatePDFFilename(invoice) {
  const {date, clientId, clientName, invoiceNumber
  } = invoice;

  // Sanitizar el nombre del cliente (quitar caracteres especiales)
  const sanitizedName = clientName
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50); // Limitar longitud

  return `${date}_${clientId}_${sanitizedName}_${invoiceNumber}.pdf`;
}

/**
 * Espera un tiempo aleatorio entre min y max milisegundos
 * Útil para evitar ser detectado como bot
 */
export async function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Reintenta una función con backoff exponencial
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      console.log(`Intento ${i + 1} fallido. Reintentando en ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Sanitiza un string para uso en nombres de archivo
 */
export function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // Caracteres no permitidos en Windows
    .replace(/\s+/g, '_') // Espacios a underscores
    .substring(0, 200); // Limitar longitud
}

/**
 * Formatea un número con separadores de miles
 */
export function formatNumber(num) {
  return num.toLocaleString('es-MX');
}

/**
 * Calcula el progreso porcentual
 */
export function calculateProgress(current, total) {
  return total > 0 ? Math.round((current / total) * 100) : 0;
}

export default {
  getYesterdayDate,
  getYesterdayDateFormatted,
  getTodayDate,
  createDownloadFolder,
  generatePDFFilename,
  randomDelay,
  retryWithBackoff,
  sanitizeFilename,
  formatNumber,
  calculateProgress
};
