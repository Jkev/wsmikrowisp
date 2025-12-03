import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { generatePDFFilename, retryWithBackoff, randomDelay } from '../utils/helpers.js';
import { waitConfig } from '../config/selectors.js';
import https from 'https';
import http from 'http';

/**
 * Servicio de descarga de PDFs
 */
export class DownloadService {
  constructor(page, downloadPath) {
    this.page = page;
    this.downloadPath = downloadPath;
    this.downloadedFiles = [];
    this.failedDownloads = [];
  }

  /**
   * Configura el directorio de descargas en Puppeteer
   */
  async setupDownloadBehavior() {
    const client = await this.page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: this.downloadPath
    });

    logger.info(`Directorio de descargas configurado: ${this.downloadPath}`);
  }

  /**
   * Descarga un PDF desde una URL usando HTTP request
   */
  async downloadPDFFromURL(url, filePath, cookieString) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      const options = {
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const file = fs.createWriteStream(filePath);

      protocol.get(url, options, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(filePath, () => {}); // Eliminar archivo parcial
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(filePath, () => {}); // Eliminar archivo parcial
        reject(err);
      });
    });
  }

  /**
   * Espera a que se complete una descarga
   */
  async waitForDownload(timeout = 30000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = 500;

      const interval = setInterval(() => {
        const files = fs.readdirSync(this.downloadPath);
        const downloadingFile = files.find(f => f.endsWith('.crdownload') || f.endsWith('.tmp'));

        if (!downloadingFile && files.length > 0) {
          // Encontrar el archivo más reciente
          const latestFile = files
            .map(f => ({
              name: f,
              time: fs.statSync(path.join(this.downloadPath, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time)[0];

          clearInterval(interval);
          resolve(latestFile.name);
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          reject(new Error('Timeout esperando descarga'));
        }
      }, checkInterval);
    });
  }

  /**
   * Descarga el PDF de una factura específica
   */
  async downloadInvoicePDF(invoice, rowIndex) {
    try {
      logger.info(`Descargando PDF: ${invoice.invoiceNumber} - ${invoice.clientName}`);

      // Contar archivos antes de la descarga
      const filesBefore = fs.readdirSync(this.downloadPath).length;

      // PASO 1: Escuchar nuevas pestañas/ventanas que se abran
      const browser = this.page.browser();
      let newPage = null;

      const newTargetPromise = new Promise(resolve => {
        browser.once('targetcreated', async target => {
          if (target.type() === 'page') {
            newPage = await target.page();
            resolve(newPage);
          }
        });
      });

      // PASO 2: Hacer click en el número de factura
      const invoiceClicked = await this.page.evaluate((index, invoiceNum) => {
        const rows = document.querySelectorAll('table#facturas-cliente tbody tr');
        const row = rows[index];

        if (!row) {
          console.error(`Fila ${index} no encontrada`);
          return false;
        }

        const cells = row.querySelectorAll('td');
        console.log(`Fila ${index} (Factura ${invoiceNum}): ${cells.length} celdas`);

        // Buscar el link del número de factura en la primera celda
        const invoiceLink = cells[0]?.querySelector('a');

        if (invoiceLink) {
          console.log(`✓ Click en número de factura: ${invoiceLink.textContent?.trim()}`);
          invoiceLink.click();
          return true;
        }

        console.error('✗ No se encontró link de número de factura');
        return false;
      }, rowIndex, invoice.invoiceNumber);

      if (!invoiceClicked) {
        throw new Error('No se pudo hacer click en el número de factura');
      }

      // PASO 3: Esperar a que se abra nueva pestaña o que cargue modal en la misma página
      const timeout = 5000;
      let detailPage = null;

      try {
        detailPage = await Promise.race([
          newTargetPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
        ]);

        logger.info('✓ Se abrió nueva pestaña para el detalle de la factura');

        // Esperar a que cargue la nueva página (el PDF)
        await detailPage.waitForTimeout(2000);

        // Configurar comportamiento de descargas en la nueva pestaña
        const newClient = await detailPage.target().createCDPSession();
        await newClient.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: this.downloadPath
        });

        logger.info('✓ Comportamiento de descarga configurado en la nueva pestaña');

      } catch (err) {
        // No se abrió nueva pestaña, verificar si hay modal en la página actual
        logger.info('No se abrió nueva pestaña, buscando modal en la página actual...');
        detailPage = this.page;
        await this.page.waitForTimeout(2000);
      }

      // PASO 4: Obtener la URL del PDF y descargarla usando HTTP request directo
      const pdfUrl = detailPage.url();
      logger.info(`URL del PDF: ${pdfUrl}`);

      // Obtener las cookies de la sesión para autenticar la descarga
      const cookies = await detailPage.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Descargar el PDF usando HTTP request con las cookies de sesión
      const newFilename = generatePDFFilename({
        date: invoice.date,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        invoiceNumber: invoice.invoiceNumber
      });

      const filePath = path.join(this.downloadPath, newFilename);

      await this.downloadPDFFromURL(pdfUrl, filePath, cookieString);

      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error('El archivo PDF no se descargó correctamente');
      }

      logger.info(`✅ PDF descargado: ${newFilename}`);

      this.downloadedFiles.push({
        invoice,
        filename: newFilename,
        path: filePath
      });

      // Cerrar la pestaña del PDF y volver a la tabla principal
      if (detailPage && detailPage !== this.page) {
        await detailPage.close();
        logger.info('✓ Pestaña de PDF cerrada, volviendo a la tabla principal');
      }

      await this.page.waitForTimeout(1000);

      return { success: true, filename: newFilename };

    } catch (error) {
      logger.error(`Error descargando PDF de factura ${invoice.invoiceNumber}: ${error.message}`);

      // Asegurar que se cierre la pestaña en caso de error
      try {
        const pages = await this.page.browser().pages();
        if (pages.length > 2) {
          // Cerrar última pestaña abierta (la del PDF)
          await pages[pages.length - 1].close();
        }
      } catch (e) {
        // Ignorar errores al cerrar
      }

      this.failedDownloads.push({
        invoice,
        error: error.message
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Descarga PDFs de múltiples facturas con reintentos
   */
  async downloadAllPDFs(invoices) {
    try {
      await this.setupDownloadBehavior();

      const total = invoices.length;
      logger.info(`Iniciando descarga de ${total} PDFs...`);

      let downloaded = 0;
      let failed = 0;

      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i];
        const progress = Math.round(((i + 1) / total) * 100);

        logger.info(`[${i + 1}/${total}] (${progress}%) Procesando: ${invoice.invoiceNumber}`);

        // Intentar descarga con reintentos
        const result = await retryWithBackoff(
          () => this.downloadInvoicePDF(invoice, invoice.rowIndex || i),
          3,
          2000
        ).catch(error => {
          logger.error(`Falló después de 3 intentos: ${error.message}`);
          return { success: false, error: error.message };
        });

        if (result.success) {
          downloaded++;
        } else {
          failed++;
        }

        // Pequeña espera entre descargas para no sobrecargar
        if (i < invoices.length - 1) {
          await randomDelay(waitConfig.betweenDownloads, waitConfig.betweenDownloads + 1000);
        }
      }

      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`RESUMEN DE DESCARGAS:`);
      logger.info(`Total: ${total}`);
      logger.info(`✅ Exitosas: ${downloaded}`);
      logger.info(`❌ Fallidas: ${failed}`);
      logger.info(`${'='.repeat(60)}\n`);

      return {
        total,
        downloaded,
        failed,
        downloadedFiles: this.downloadedFiles,
        failedDownloads: this.failedDownloads
      };

    } catch (error) {
      logger.error(`Error en descarga masiva: ${error.message}`);
      throw error;
    }
  }

  /**
   * Genera un reporte de las descargas
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.downloadedFiles.length + this.failedDownloads.length,
        successful: this.downloadedFiles.length,
        failed: this.failedDownloads.length
      },
      successfulDownloads: this.downloadedFiles.map(d => ({
        invoiceNumber: d.invoice.invoiceNumber,
        clientName: d.invoice.clientName,
        clientId: d.invoice.clientId,
        filename: d.filename
      })),
      failedDownloads: this.failedDownloads.map(d => ({
        invoiceNumber: d.invoice.invoiceNumber,
        clientName: d.invoice.clientName,
        clientId: d.invoice.clientId,
        error: d.error
      }))
    };

    const reportPath = path.join(this.downloadPath, 'download-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    logger.info(`Reporte generado: ${reportPath}`);
    return report;
  }
}

export default DownloadService;
