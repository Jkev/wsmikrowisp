import puppeteer from 'puppeteer';
import { logger } from './utils/logger.js';
import { getYesterdayDate, getTodayDate } from './utils/helpers.js';
import AuthService from './services/auth.service.js';
import NavigationService from './services/navigation.service.js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { format } from 'date-fns';

/**
 * Script de producción para descargar transacciones
 * Descarga automáticamente PDFs de facturas del día anterior
 *
 * Uso:
 *   npm run transacciones                    # Modo visible (para debugging)
 *   HEADLESS=true npm run transacciones      # Modo headless (para producción)
 */

// Configuración de modo headless desde variable de entorno
const HEADLESS_MODE = process.env.HEADLESS === 'true';
const MAX_RETRIES = 3; // Número máximo de reintentos por PDF

/**
 * Descarga un PDF desde una URL usando cookies de sesión
 */
async function downloadPDFFromURL(url, filePath, cookieString) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const options = {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
        fs.unlink(filePath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

async function downloadTransacciones() {
  const browser = await puppeteer.launch({
    headless: HEADLESS_MODE,
    defaultViewport: HEADLESS_MODE ? { width: 1920, height: 1080 } : null,
    args: HEADLESS_MODE ? [] : ['--start-maximized']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);

  // Capturar console.log del navegador
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('✓') || text.includes('✗') || text.includes('Botones') || text.includes('Opción')) {
      logger.info(`[Browser] ${text}`);
    }
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    // 1. Login usando el servicio de autenticación
    logger.info('🔐 Iniciando login...');
    const authService = new AuthService(page);
    await authService.login();
    logger.info('✅ Login exitoso');

    // 2. Navegar a Transacciones
    logger.info('📊 Navegando a Transacciones...');
    const transaccionesUrl = page.url().replace(/#.*$/, '') + '#ajax/transacciones';
    logger.info(`URL: ${transaccionesUrl}`);

    await page.goto(transaccionesUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    logger.info('✅ Navegación exitosa a Transacciones');

    // 3. Obtener fecha del día anterior
    const targetDate = getYesterdayDate();
    logger.info(`📅 Fecha objetivo (día anterior): ${targetDate}`);

    // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY (formato de MikroWISP)
    const [year, month, day] = targetDate.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    logger.info(`📅 Fecha formateada: ${formattedDate}`);

    // 4. Buscar y completar los campos de fecha
    logger.info('🔍 Buscando inputs de fecha...');

    await page.waitForTimeout(3000);

    const allInputs = await page.$$('input[type="text"]');
    logger.info(`📝 Inputs de texto encontrados: ${allInputs.length}`);

    if (allInputs.length >= 2) {
      // Los primeros 2 inputs de texto son las fechas "desde" y "hasta"
      const dateFromInput = allInputs[0];
      const dateToInput = allInputs[1];

      // Limpiar y escribir fecha "desde"
      logger.info('📝 Ingresando fecha "desde"...');
      await dateFromInput.click({ clickCount: 3 }); // Seleccionar todo
      await page.keyboard.press('Backspace'); // Borrar
      await page.waitForTimeout(300);
      await dateFromInput.type(formattedDate, { delay: 100 });

      // Limpiar y escribir fecha "hasta"
      logger.info('📝 Ingresando fecha "hasta"...');
      await dateToInput.click({ clickCount: 3 }); // Seleccionar todo
      await page.keyboard.press('Backspace'); // Borrar
      await page.waitForTimeout(300);
      await dateToInput.type(formattedDate, { delay: 100 });

      logger.info(`✅ Fechas ingresadas: ${formattedDate} - ${formattedDate}`);

      // Cerrar el datepicker haciendo click fuera de él
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Hacer click fuera del datepicker para cerrarlo completamente
      await page.click('body');
      await page.waitForTimeout(500);

      // Buscar y hacer click en el botón de búsqueda/filtrar
      logger.info('🔍 Buscando botón de búsqueda...');
      const searchButtonClicked = await page.evaluate(() => {
        // Buscar botones con iconos de búsqueda o texto "Buscar"
        const buttons = Array.from(document.querySelectorAll('button, a, i'));

        const searchButton = buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const classes = btn.className?.toLowerCase() || '';
          return text.includes('buscar') ||
                 text.includes('filtrar') ||
                 classes.includes('search') ||
                 classes.includes('fa-search') ||
                 classes.includes('glyphicon-search');
        });

        if (searchButton) {
          console.log(`✓ Botón de búsqueda encontrado: ${searchButton.tagName}`);
          searchButton.click();
          return true;
        }
        return false;
      });

      if (searchButtonClicked) {
        logger.info('✅ Botón de búsqueda clickeado');
      } else {
        logger.info('⚠️ No se encontró botón de búsqueda, presionando Enter...');
        await dateToInput.press('Enter');
      }

      // Esperar a que la tabla se recargue
      await page.waitForTimeout(5000);

      logger.info('✅ Filtro de fecha aplicado');

      // Hacer click en el botón del dropdown de página (que muestra "15")
      logger.info('🔘 Buscando botón de paginación para mostrar todas las transacciones...');

      // Esperar un poco más para asegurar que la tabla esté cargada
      await page.waitForTimeout(2000);

      const todosClicked = await page.evaluate(() => {
        // Buscar el botón dropdown que contiene "buttons-page-length"
        const buttons = Array.from(document.querySelectorAll('button.buttons-page-length'));

        console.log(`Botones de paginación encontrados: ${buttons.length}`);

        // También buscar por la clase completa
        const allButtons = Array.from(document.querySelectorAll('button'));
        const pageLengthButtons = allButtons.filter(btn =>
          btn.className.includes('buttons-page-length') ||
          btn.getAttribute('aria-controls') === 'list-pago-cliente'
        );
        console.log(`Botones con buttons-page-length o aria-controls: ${pageLengthButtons.length}`);

        if (pageLengthButtons.length > 0) {
          const pageButton = pageLengthButtons[0];
          console.log(`✓ Botón de paginación encontrado: "${pageButton.textContent?.trim()}"`);
          console.log(`  Clases: ${pageButton.className}`);
          console.log(`  aria-expanded: ${pageButton.getAttribute('aria-expanded')}`);
          pageButton.click();
          return true;
        }

        if (buttons.length > 0) {
          const pageButton = buttons[0];
          console.log(`✓ Botón de paginación encontrado (fallback): "${pageButton.textContent?.trim()}"`);
          pageButton.click();
          return true;
        }

        console.log('✗ No se encontró el botón de paginación');
        return false;
      });

      // Verificar cuántas filas hay antes del click en "Todos"
      const rowsBeforeTodos = await page.evaluate(() => {
        const table = document.querySelector('table');
        return table?.querySelectorAll('tbody tr').length || 0;
      });
      logger.info(`📊 Filas antes de seleccionar "Todos": ${rowsBeforeTodos}`);

      if (todosClicked) {
        logger.info('✅ Botón de paginación clickeado, esperando dropdown...');
        await page.waitForTimeout(1500);

        // Hacer click en la opción "Mostrar todos" del dropdown
        const todosOptionClicked = await page.evaluate(() => {
          // Buscar específicamente en elementos del dropdown menu de DataTables
          // El dropdown de paginación de DataTables usa <a> con clase "dropdown-item" o dentro de .dt-button-collection
          const dropdownItems = Array.from(document.querySelectorAll('.dt-button-collection a, .dt-button-collection span, .dt-button-collection button, a.dt-button'));

          console.log(`Items en dropdown encontrados: ${dropdownItems.length}`);

          // Buscar elemento que contenga exactamente "Mostrar todos"
          const todosOption = dropdownItems.find(el => {
            const text = el.textContent?.trim();
            // Debe ser exactamente "Mostrar todos" o muy corto (para evitar capturar toda la página)
            return (text === 'Mostrar todos' || text === 'Todos' || text === 'All') && text.length < 20;
          });

          if (todosOption) {
            console.log(`✓ Opción encontrada: "${todosOption.textContent?.trim()}", haciendo click...`);
            todosOption.click();
            return true;
          }

          // Fallback: buscar en cualquier elemento visible pero con longitud corta
          const allElements = Array.from(document.querySelectorAll('a, li, span, button'));
          const shortTexts = allElements.filter(el => {
            const rect = el.getBoundingClientRect();
            const text = el.textContent?.trim();
            return rect.width > 0 && rect.height > 0 && text && text.length < 20;
          });

          console.log('✗ No se encontró en dropdown, buscando en elementos cortos visibles...');
          console.log('Opciones visibles:', shortTexts.map(el => el.textContent?.trim()).slice(0, 20));

          const todosOptionFallback = shortTexts.find(el => {
            const text = el.textContent?.trim();
            return text === 'Mostrar todos' || text === 'Todos';
          });

          if (todosOptionFallback) {
            console.log(`✓ Opción encontrada (fallback): "${todosOptionFallback.textContent?.trim()}"`);
            todosOptionFallback.click();
            return true;
          }

          console.log('✗ No se encontró la opción "Mostrar todos"');
          return false;
        });

        if (todosOptionClicked) {
          logger.info('✅ Opción "Todos" seleccionada, esperando recarga...');
          await page.waitForTimeout(5000);

          // Verificar cuántas filas hay después del click
          const rowsAfterTodos = await page.evaluate(() => {
            const table = document.querySelector('table');
            return table?.querySelectorAll('tbody tr').length || 0;
          });
          logger.info(`📊 Filas después de seleccionar "Todos": ${rowsAfterTodos}`);
          logger.info('✅ Mostrando todas las transacciones');
        } else {
          logger.warn('⚠️ No se pudo seleccionar la opción "Todos" del dropdown');
        }
      } else {
        logger.warn('⚠️ No se encontró el botón de paginación');
      }

    } else {
      logger.warn(`⚠️ Solo se encontraron ${allInputs.length} inputs de texto`);
    }

    // 5. Verificar y activar columna "# Factura" si es necesario
    logger.info('🔘 Verificando visibilidad de columna "# Factura"...');

    await page.waitForTimeout(2000);

    const columnButtonClicked = await page.evaluate(() => {
      const colvisButtons = Array.from(document.querySelectorAll('button.buttons-colvis'));
      console.log(`Botones de columnas encontrados: ${colvisButtons.length}`);

      if (colvisButtons.length > 0) {
        const colButton = colvisButtons[0];
        console.log(`✓ Botón de columnas encontrado, haciendo click...`);
        colButton.click();
        return true;
      }

      console.log('✗ No se encontró el botón de columnas');
      return false;
    });

    if (columnButtonClicked) {
      logger.info('✅ Botón de columnas clickeado, esperando dropdown...');
      await page.waitForTimeout(1500);

      // Activar columna "# Factura" si no está visible
      const facturaColumnActivated = await page.evaluate(() => {
        const allOptions = Array.from(document.querySelectorAll('a, li, span, div, label, input'));

        // Buscar checkbox o opción de "# Factura"
        const facturaOption = allOptions.find(el => {
          const text = el.textContent?.trim();
          return text === '# Factura' ||
                 text === 'Factura' ||
                 text?.includes('# Factura');
        });

        if (facturaOption) {
          console.log(`✓ Opción "# Factura" encontrada: "${facturaOption.textContent?.trim()}"`);

          // Si es un checkbox, verificar si ya está activado
          const checkbox = facturaOption.querySelector('input[type="checkbox"]') ||
                          (facturaOption.tagName === 'INPUT' ? facturaOption : null);

          if (checkbox) {
            if (!checkbox.checked) {
              console.log('Activando checkbox...');
              checkbox.click();
              return true;
            } else {
              console.log('Checkbox ya está activado');
              return true;
            }
          } else {
            // Si no es checkbox, hacer click directamente
            facturaOption.click();
            return true;
          }
        }

        console.log('✗ No se encontró la opción "# Factura"');
        return false;
      });

      if (facturaColumnActivated) {
        logger.info('✅ Columna "# Factura" verificada/activada');
        await page.waitForTimeout(2000);
      } else {
        logger.warn('⚠️ No se pudo encontrar la opción "# Factura" (puede que ya esté visible)');
      }

      // Cerrar el dropdown haciendo click fuera
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else {
      logger.warn('⚠️ No se encontró el botón de columnas (puede que no sea necesario)');
    }

    // 6. Analizar la estructura de la tabla
    logger.info('🔍 Analizando estructura de la tabla de transacciones...');

    const tableInfo = await page.evaluate(() => {
      const table = document.querySelector('table');
      if (!table) return { error: 'No se encontró tabla' };

      // Obtener headers
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim());

      // Obtener primera fila de datos
      const firstRow = table.querySelector('tbody tr');
      const cells = firstRow ? Array.from(firstRow.querySelectorAll('td')).map(td => ({
        text: td.textContent?.trim().substring(0, 50),
        hasLink: !!td.querySelector('a'),
        linkText: td.querySelector('a')?.textContent?.trim()
      })) : [];

      return {
        headers,
        headerCount: headers.length,
        firstRowCells: cells,
        totalRows: table.querySelectorAll('tbody tr').length
      };
    });

    logger.info('📊 Información de la tabla:');
    logger.info(`Headers: ${JSON.stringify(tableInfo.headers)}`);
    logger.info(`Total de columnas: ${tableInfo.headerCount}`);
    logger.info(`Total de filas: ${tableInfo.totalRows}`);
    logger.info(`Primera fila: ${JSON.stringify(tableInfo.firstRowCells, null, 2)}`);

    // 7. Extraer transacciones de la tabla
    logger.info('📋 Extrayendo transacciones de la tabla...');

    const transactions = await page.evaluate((targetFormattedDate) => {
      const table = document.querySelector('table');
      if (!table) return { transactions: [], indices: null };

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim());

      // Encontrar índice de columnas
      const facturaIndex = headers.findIndex(h => h === '# Factura');
      const clienteIndex = headers.findIndex(h => h === 'Cliente');
      const idIndex = headers.findIndex(h => h === 'ID');
      const cobradoIndex = headers.findIndex(h => h === 'Cobrado');
      const fechaHoraIndex = headers.findIndex(h => h === 'Fecha & Hora');

      const indices = { facturaIndex, clienteIndex, idIndex, cobradoIndex, fechaHoraIndex, headers };

      const transactions = rows.map((row, index) => {
        const cells = Array.from(row.querySelectorAll('td'));

        const facturaCell = cells[facturaIndex];
        const facturaLink = facturaCell?.querySelector('a');
        const facturaNumber = facturaLink?.textContent?.trim();

        const clienteCell = cells[clienteIndex];
        const clientName = clienteCell?.textContent?.trim();

        const idCell = cells[idIndex];
        const clientId = idCell?.textContent?.trim();

        const cobradoCell = cells[cobradoIndex];
        const amount = cobradoCell?.textContent?.trim();

        const fechaHoraCell = cells[fechaHoraIndex];
        const fechaHora = fechaHoraCell?.textContent?.trim();

        return {
          rowIndex: index,
          facturaNumber,
          clientName,
          clientId,
          amount,
          fechaHora,
          hasLink: !!facturaLink
        };
      })
      .filter(t => t.hasLink && t.facturaNumber) // Solo transacciones con link de factura
      .filter(t => {
        // Filtrar por fecha: la columna "Fecha & Hora" tiene formato "DD/MM/YYYY HH:MM:SS"
        if (!t.fechaHora) return false;
        const dateStr = t.fechaHora.split(' ')[0]; // Obtener solo la fecha "DD/MM/YYYY"
        return dateStr === targetFormattedDate;
      });

      return { transactions, indices };
    }, formattedDate);

    logger.info(`📊 Índices de columnas: ${JSON.stringify(transactions.indices)}`);
    logger.info(`🔍 Fecha objetivo para filtrado: ${formattedDate}`);
    logger.info(`✅ Transacciones filtradas por fecha: ${transactions.transactions.length}`);
    if (transactions.transactions.length > 0) {
      logger.info(`Primera transacción filtrada: ${JSON.stringify(transactions.transactions[0], null, 2)}`);
    } else {
      logger.warn(`⚠️ No se encontraron transacciones para la fecha ${formattedDate}`);
    }

    // Extraer solo el array de transacciones para el resto del código
    const transactionsList = transactions.transactions;

    // 8. Crear carpeta de descargas
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const downloadDir = path.join(process.cwd(), 'downloads', 'transacciones', dateStr);
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    logger.info(`📁 Carpeta de descargas: ${downloadDir}`);

    // 9. Descargar PDFs
    const transactionsToProcess = transactionsList;
    logger.info(`\n📥 Descargando ${transactionsToProcess.length} PDFs...`);

    const downloadResults = {
      successful: [],
      failed: []
    };

    for (let i = 0; i < transactionsToProcess.length; i++) {
      const transaction = transactionsToProcess[i];
      logger.info(`\n[${i + 1}/${transactionsToProcess.length}] Procesando factura ${transaction.facturaNumber}...`);

      let detailPage = null;

      try {
        // Escuchar para nuevas tabs
        const newTargetPromise = new Promise(resolve => {
          browser.once('targetcreated', async target => {
            if (target.type() === 'page') {
              resolve(await target.page());
            }
          });
        });

        // Hacer click en el link de factura
        const clicked = await page.evaluate((rowIndex, facturaIndex) => {
          const table = document.querySelector('table');
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          const row = rows[rowIndex];
          const cells = Array.from(row.querySelectorAll('td'));
          const facturaCell = cells[facturaIndex];
          const facturaLink = facturaCell?.querySelector('a');

          if (facturaLink) {
            facturaLink.click();
            return true;
          }
          return false;
        }, transaction.rowIndex, 2); // Índice 2 es "# Factura"

        if (!clicked) {
          throw new Error('No se pudo hacer click en el link de factura');
        }

        logger.info('✓ Click en factura, esperando nueva pestaña...');

        // Esperar la nueva pestaña
        detailPage = await Promise.race([
          newTargetPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout esperando nueva pestaña')), 8000)
          )
        ]);

        await detailPage.waitForTimeout(2000);

        // Obtener URL del PDF
        const pdfUrl = detailPage.url();
        logger.info(`✓ PDF URL: ${pdfUrl}`);

        // Obtener cookies
        const cookies = await detailPage.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        // Generar nombre de archivo
        const safeClientName = transaction.clientName?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'Cliente';
        const filename = `${transaction.amount}_${transaction.clientId}_${safeClientName}_${transaction.facturaNumber}.pdf`;
        const filePath = path.join(downloadDir, filename);

        logger.info(`📥 Descargando: ${filename}`);

        // Descargar PDF
        await downloadPDFFromURL(pdfUrl, filePath, cookieString);

        logger.info(`✅ Descargado: ${filename}`);

        downloadResults.successful.push({
          facturaNumber: transaction.facturaNumber,
          clientName: transaction.clientName,
          clientId: transaction.clientId,
          amount: transaction.amount,
          filename
        });

        // Cerrar pestaña del PDF
        if (detailPage && detailPage !== page) {
          await detailPage.close();
          detailPage = null;
        }

        // Volver a la página principal
        await page.bringToFront();
        await page.waitForTimeout(1000);

      } catch (error) {
        logger.error(`❌ Error descargando factura ${transaction.facturaNumber}: ${error.message}`);

        downloadResults.failed.push({
          facturaNumber: transaction.facturaNumber,
          clientName: transaction.clientName,
          error: error.message
        });

        // Cerrar pestaña si quedó abierta
        if (detailPage && detailPage !== page) {
          try {
            await detailPage.close();
          } catch (e) {
            // Ignorar errores al cerrar
          }
        }

        // Volver a la página principal
        await page.bringToFront();
        await page.waitForTimeout(1000);
      }
    }

    // 10. Resumen final
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 RESUMEN DE DESCARGAS');
    logger.info('='.repeat(60));
    logger.info(`✅ Exitosas: ${downloadResults.successful.length}`);
    logger.info(`❌ Fallidas: ${downloadResults.failed.length}`);
    logger.info(`📁 Carpeta: ${downloadDir}`);

    if (downloadResults.successful.length > 0) {
      logger.info('\n✅ Descargas exitosas:');
      downloadResults.successful.forEach((d, i) => {
        logger.info(`  ${i + 1}. ${d.filename}`);
      });
    }

    if (downloadResults.failed.length > 0) {
      logger.info('\n❌ Descargas fallidas:');
      downloadResults.failed.forEach((d, i) => {
        logger.info(`  ${i + 1}. Factura ${d.facturaNumber} - ${d.error}`);
      });
    }

    // Guardar reporte
    const reportPath = path.join(downloadDir, 'download-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: transactionsToProcess.length,
        successful: downloadResults.successful.length,
        failed: downloadResults.failed.length
      },
      successfulDownloads: downloadResults.successful,
      failedDownloads: downloadResults.failed
    }, null, 2));

    logger.info(`\n📄 Reporte guardado: ${reportPath}`);

    // Screenshot final
    await page.screenshot({
      path: 'logs/transacciones-completado.png',
      fullPage: true
    });
    logger.info('📸 Screenshot guardado: logs/transacciones-completado.png');

    logger.info('\n✅ PROCESO COMPLETADO');
    logger.info('📁 Archivos descargados en: ' + downloadDir);

    // Cerrar navegador en modo headless, dejarlo abierto en modo visible
    if (HEADLESS_MODE) {
      logger.info('🔒 Cerrando navegador...\n');
      await browser.close();
      process.exit(0);
    } else {
      logger.info('⏸️ El navegador permanecerá abierto. Presiona Ctrl+C para cerrar.\n');
      // Mantener abierto para inspección manual
      await new Promise(() => {});
    }

  } catch (error) {
    logger.error('❌ Error:', error?.message || 'Error desconocido');
    if (error?.stack) {
      logger.error('Stack trace:', error.stack);
    }
    try {
      await page.screenshot({ path: 'logs/transacciones-error.png' });
      logger.info('Screenshot guardado: logs/transacciones-error.png');
    } catch (screenshotError) {
      logger.error('No se pudo tomar screenshot');
    }
    throw error; // Re-throw para que el proceso termine
  }
}

// Ejecutar script
logger.info(`🚀 Iniciando descarga de transacciones (${HEADLESS_MODE ? 'HEADLESS' : 'VISIBLE'})`);
downloadTransacciones()
  .then(() => {
    logger.info('✅ Script finalizado correctamente');
  })
  .catch((error) => {
    logger.error('❌ Error fatal:', error?.message);
    process.exit(1);
  });
