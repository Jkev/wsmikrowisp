#!/usr/bin/env node

import puppeteer from 'puppeteer';
import { logger, createRunLogger } from './utils/logger.js';
import { createDownloadFolder, getYesterdayDate, getTodayDate } from './utils/helpers.js';
import AuthService from './services/auth.service.js';
import NavigationService from './services/navigation.service.js';
import ScraperService from './services/scraper.service.js';
import DownloadService from './services/download.service.js';

/**
 * Script principal para descarga automática de PDFs de facturas de MikroWISP
 */

class MikroWISPScraper {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false, // Headless por defecto
      date: options.date || null, // null = día anterior
      ...options
    };

    this.browser = null;
    this.page = null;
    this.runId = getTodayDate();
    this.runLogger = createRunLogger(this.runId);
  }

  /**
   * Inicializa el navegador
   */
  async init() {
    try {
      this.runLogger.info('🚀 Iniciando MikroWISP Scraper...');
      this.runLogger.info(`Modo: ${this.options.headless ? 'Headless' : 'Con interfaz'}`);

      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        defaultViewport: null,
        args: [
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      this.page = await this.browser.newPage();
      this.page.setDefaultNavigationTimeout(90000);

      // Configurar user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      this.runLogger.info('✅ Navegador inicializado');

    } catch (error) {
      this.runLogger.error(`Error inicializando navegador: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ejecuta el proceso completo de scraping
   */
  async run() {
    const startTime = Date.now();

    try {
      // 1. Inicializar navegador
      await this.init();

      // 2. Autenticación
      this.runLogger.info('\n📍 PASO 1/5: Autenticación');
      const authService = new AuthService(this.page);
      await authService.login();

      // 3. Navegación a Facturas
      this.runLogger.info('\n📍 PASO 2/5: Navegación a Facturas');
      const navService = new NavigationService(this.page);
      await navService.navigateToFacturas();

      // 4. Scraping de facturas
      this.runLogger.info('\n📍 PASO 3/5: Extracción de facturas');
      const scraperService = new ScraperService(this.page);
      const targetDate = this.options.date || getYesterdayDate();
      this.runLogger.info(`Buscando facturas del: ${targetDate}`);

      const invoices = await scraperService.getAllInvoices(targetDate);

      if (invoices.length === 0) {
        this.runLogger.warn(`⚠️  No se encontraron facturas para la fecha: ${targetDate}`);
        await this.cleanup();
        return {
          success: true,
          invoices: 0,
          downloaded: 0,
          failed: 0
        };
      }

      // 5. Crear carpeta de descargas
      this.runLogger.info('\n📍 PASO 4/5: Preparando descarga de PDFs');
      const downloadPath = createDownloadFolder();
      this.runLogger.info(`Carpeta de descargas: ${downloadPath}`);

      // 6. Descarga de PDFs (limitar a 3 en modo test)
      this.runLogger.info('\n📍 PASO 5/5: Descarga de PDFs');
      const downloadService = new DownloadService(this.page, downloadPath);

      // En modo test, solo descargar las primeras 3 facturas
      const isTest = !this.options.headless;
      const invoicesToDownload = isTest ? invoices.slice(0, 3) : invoices;
      if (isTest) {
        this.runLogger.info(`⚠️  MODO TEST: Descargando solo las primeras 3 de ${invoices.length} facturas`);
      }

      const downloadResult = await downloadService.downloadAllPDFs(invoicesToDownload);

      // 7. Generar reporte
      const report = downloadService.generateReport();

      // 8. Resumen final
      const duration = Math.round((Date.now() - startTime) / 1000);
      this.runLogger.info('\n' + '='.repeat(70));
      this.runLogger.info('🎉 PROCESO COMPLETADO');
      this.runLogger.info('='.repeat(70));
      this.runLogger.info(`Fecha procesada: ${targetDate}`);
      this.runLogger.info(`Facturas encontradas: ${invoices.length}`);
      this.runLogger.info(`PDFs descargados: ${downloadResult.downloaded}`);
      this.runLogger.info(`Fallos: ${downloadResult.failed}`);
      this.runLogger.info(`Duración: ${duration}s`);
      this.runLogger.info(`Carpeta de descargas: ${downloadPath}`);
      this.runLogger.info('='.repeat(70) + '\n');

      await this.cleanup();

      return {
        success: true,
        date: targetDate,
        invoices: invoices.length,
        downloaded: downloadResult.downloaded,
        failed: downloadResult.failed,
        duration,
        downloadPath,
        report
      };

    } catch (error) {
      this.runLogger.error(`\n❌ ERROR FATAL: ${error.message}`);
      this.runLogger.error(error.stack);

      // Tomar screenshot del error
      if (this.page) {
        try {
          await this.page.screenshot({
            path: `logs/error-${this.runId}.png`,
            fullPage: true
          });
          this.runLogger.info('Screenshot de error guardado');
        } catch (e) {
          // Ignorar errores al tomar screenshot
        }
      }

      await this.cleanup();

      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Limpieza y cierre
   */
  async cleanup() {
    try {
      if (this.browser) {
        this.runLogger.info('Cerrando navegador...');
        await this.browser.close();
        this.runLogger.info('✅ Navegador cerrado');
      }
    } catch (error) {
      this.runLogger.warn(`Error en cleanup: ${error.message}`);
    }
  }
}

// Ejecución principal
async function main() {
  const args = process.argv.slice(2);

  const options = {
    headless: !args.includes('--no-headless'),
    date: null // Por defecto usa día anterior
  };

  // Permitir especificar fecha manualmente
  const dateArg = args.find(arg => arg.startsWith('--date='));
  if (dateArg) {
    options.date = dateArg.split('=')[1];
  }

  // Modo test (con interfaz visible)
  if (args.includes('--test')) {
    options.headless = false;
    logger.info('🧪 Modo TEST activado (navegador visible)');
  }

  const scraper = new MikroWISPScraper(options);
  const result = await scraper.run();

  // Exit code según resultado
  process.exit(result.success ? 0 : 1);
}

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('\n\n🛑 Proceso interrumpido por el usuario');
  process.exit(0);
});

// Ejecutar si es el archivo principal
// Normalizar rutas para Windows
const currentFile = import.meta.url;
const mainFile = `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (currentFile === mainFile || currentFile.endsWith('src/index.js')) {
  main();
}

export default MikroWISPScraper;
