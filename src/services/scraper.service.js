import { logger } from '../utils/logger.js';
import { selectors, waitConfig } from '../config/selectors.js';
import { getYesterdayDate } from '../utils/helpers.js';

/**
 * Servicio de scraping de facturas
 */
export class ScraperService {
  constructor(page) {
    this.page = page;
  }

  /**
   * Aplica filtro de fecha para obtener facturas PAGADAS del día anterior
   */
  async filterByDate(date = null) {
    try {
      const targetDate = date || getYesterdayDate();
      logger.info(`Filtrando facturas PAGADAS por fecha de pago: ${targetDate}`);

      // PASO 1: Seleccionar dropdown "Estado: Pagadas"
      logger.info('1/2: Seleccionando estado "Pagadas"...');

      // Buscar el dropdown de estado (el que dice "Cualquiera")
      const estadoSelected = await this.page.evaluate(() => {
        // Buscar todos los dropdowns/selects
        const selects = Array.from(document.querySelectorAll('select, [role="listbox"]'));

        for (const select of selects) {
          // Buscar el que contiene opciones de estado
          const options = Array.from(select.querySelectorAll('option'));
          const hasPagadas = options.some(opt =>
            opt.textContent?.includes('Pagadas') || opt.textContent?.includes('Pagada')
          );

          if (hasPagadas) {
            // Seleccionar la opción "Pagadas"
            const pagadasOption = options.find(opt =>
              opt.textContent?.includes('Pagadas') || opt.textContent?.includes('Pagada')
            );

            if (pagadasOption) {
              select.value = pagadasOption.value;
              // Disparar evento change
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }

        return false;
      });

      if (!estadoSelected) {
        logger.warn('⚠️  No se pudo seleccionar el estado "Pagadas", continuando...');
      } else {
        logger.info('✅ Estado "Pagadas" seleccionado');
        await this.page.waitForTimeout(2000); // Esperar a que se actualice
      }

      // PASO 2: Filtrar por F. PAGADO (fecha de pago = día anterior)
      logger.info('2/2: Filtrando por fecha de pago...');

      // Esperar un poco más para asegurar que los inputs de fecha estén cargados
      await this.page.waitForTimeout(3000);

      // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY (formato de MikroWISP)
      const [year, month, day] = targetDate.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      // Buscar inputs de fecha (son de tipo texto con datepicker)
      // Según el screenshot, los primeros 2 inputs de texto son las fechas
      const allInputs = await this.page.$$('input[type="text"]');

      logger.info(`Inputs de texto encontrados: ${allInputs.length}`);

      if (allInputs.length < 2) {
        await this.page.screenshot({ path: 'logs/no-inputs.png' });
        throw new Error(`No se encontraron suficientes inputs. Total: ${allInputs.length}`);
      }

      // Los primeros 2 inputs de texto son las fechas "desde" y "hasta"
      const dateFromInput = allInputs[0];
      const dateToInput = allInputs[1];

      // Limpiar y escribir fecha "desde"
      logger.info('Ingresando fecha "desde"...');
      await dateFromInput.click({ clickCount: 3 }); // Seleccionar todo
      await this.page.keyboard.press('Backspace'); // Borrar
      await this.page.waitForTimeout(300);
      await dateFromInput.type(formattedDate, { delay: 100 });

      // Limpiar y escribir fecha "hasta"
      logger.info('Ingresando fecha "hasta"...');
      await dateToInput.click({ clickCount: 3 }); // Seleccionar todo
      await this.page.keyboard.press('Backspace'); // Borrar
      await this.page.waitForTimeout(300);
      await dateToInput.type(formattedDate, { delay: 100 });

      logger.info(`✅ Fechas ingresadas: ${formattedDate} - ${formattedDate}`);

      // Presionar Enter para aplicar filtro
      await this.page.keyboard.press('Enter');

      // Esperar a que carguen los resultados
      logger.info('Esperando resultados filtrados...');
      await this.page.waitForTimeout(waitConfig.forTableLoad);

      // Hacer click en el botón "Todos" para mostrar todas las facturas
      logger.info('Seleccionando "Todos" para mostrar todas las facturas...');
      const todosClicked = await this.page.evaluate(() => {
        // Buscar el botón que contiene "Todos"
        const buttons = Array.from(document.querySelectorAll('button'));
        const todosButton = buttons.find(btn =>
          btn.textContent?.trim().includes('Todos') &&
          btn.className?.includes('buttons-page-length')
        );

        if (todosButton) {
          todosButton.click();
          return true;
        }
        return false;
      });

      if (todosClicked) {
        await this.page.waitForTimeout(1000);

        // Hacer click en la opción "Todos" del dropdown
        const todosOptionClicked = await this.page.evaluate(() => {
          // Buscar en el dropdown que apareció
          const options = Array.from(document.querySelectorAll('a, li, span'));
          const todosOption = options.find(opt =>
            opt.textContent?.trim() === 'Todos'
          );

          if (todosOption) {
            todosOption.click();
            return true;
          }
          return false;
        });

        if (todosOptionClicked) {
          logger.info('✅ Mostrando todas las facturas');
          await this.page.waitForTimeout(2000);
        }
      }

      logger.info('✅ Filtro de fecha aplicado');
      return true;

    } catch (error) {
      logger.error(`Error aplicando filtro de fecha: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extrae la lista de facturas de la tabla actual
   */
  async extractInvoices() {
    try {
      logger.info('Extrayendo facturas de la tabla...');

      const invoices = await this.page.evaluate((sel) => {
        const rows = document.querySelectorAll(sel.tableRows || 'table tbody tr');
        const invoices = [];
        const colIdx = sel.columnIndexes;

        rows.forEach((row, index) => {
          try {
            const cells = row.querySelectorAll('td');

            if (cells.length === 0) return;

            // Estructura según la tabla real de MikroWISP:
            // 0: N° FACTURA, 1: N° CÉDULA, 2: TIPO, 3: CLIENTE,
            // 4: F. EMITIDO, 5: F. VENCIMIENTO, 6: F. PAGADO,
            // 7: TOTAL, 8: SALDO, 9: FORMA DE PAGO,
            // 10: N° IDENTIFICACIÓN, 11: ESTADO, 12+: Acciones

            const invoice = {
              rowIndex: index,
              invoiceNumber: cells[colIdx.invoiceNumber]?.textContent?.trim() || `INV-${index}`,
              clientId: cells[colIdx.clientId]?.textContent?.trim() || 'N/A',
              type: cells[colIdx.type]?.textContent?.trim() || 'N/A',
              clientName: cells[colIdx.clientName]?.textContent?.trim() || 'N/A',
              issueDate: cells[colIdx.issueDate]?.textContent?.trim() || 'N/A',
              dueDate: cells[colIdx.dueDate]?.textContent?.trim() || 'N/A',
              paidDate: cells[colIdx.paidDate]?.textContent?.trim() || 'N/A',
              total: cells[colIdx.total]?.textContent?.trim() || '0',
              balance: cells[colIdx.balance]?.textContent?.trim() || '0',
              paymentMethod: cells[colIdx.paymentMethod]?.textContent?.trim() || 'N/A',
              identification: cells[colIdx.identification]?.textContent?.trim() || 'N/A',
              status: cells[colIdx.status]?.textContent?.trim() || 'N/A',

              // Para compatibilidad con el sistema de descarga
              // IMPORTANTE: Usar F. PAGADO (paidDate) como fecha principal
              date: cells[colIdx.paidDate]?.textContent?.trim() || cells[colIdx.issueDate]?.textContent?.trim() || 'N/A',
              amount: cells[colIdx.total]?.textContent?.trim() || '0',
            };

            // Buscar botón de imprimir/PDF en la columna de acciones
            const actionsCell = cells[colIdx.actions] || cells[cells.length - 1];
            const pdfButton = actionsCell?.querySelector('button[title*="Imprimir"], i[class*="print"], button');

            if (pdfButton) {
              invoice.hasPDF = true;
              invoice.pdfButtonIndex = index;
            } else {
              invoice.hasPDF = false;
            }

            // Filtrar filas que NO son facturas reales
            // Las filas de resumen tienen números de factura como "Pagadas", "TOTALES", etc.
            const isValidInvoice = invoice.invoiceNumber &&
                                  !isNaN(invoice.invoiceNumber) &&
                                  invoice.invoiceNumber !== 'N/A';

            if (isValidInvoice) {
              invoices.push(invoice);
            }

          } catch (err) {
            console.error(`Error procesando fila ${index}:`, err.message);
          }
        });

        return invoices;
      }, selectors.facturas);

      logger.info(`✅ ${invoices.length} facturas encontradas`);
      return invoices;

    } catch (error) {
      logger.error(`Error extrayendo facturas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica si hay más páginas de resultados
   */
  async hasNextPage() {
    try {
      if (!selectors.facturas.pagination.nextButton) {
        return false;
      }

      return await this.page.evaluate((selector) => {
        const nextBtn = document.querySelector(selector);
        return nextBtn && !nextBtn.disabled && nextBtn.offsetParent !== null;
      }, selectors.facturas.pagination.nextButton);

    } catch (error) {
      return false;
    }
  }

  /**
   * Navega a la siguiente página de resultados
   */
  async goToNextPage() {
    try {
      if (selectors.facturas.pagination.nextButton) {
        await this.page.click(selectors.facturas.pagination.nextButton);
        await this.page.waitForTimeout(waitConfig.forTableLoad);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error navegando a siguiente página: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtiene todas las facturas de todas las páginas
   */
  async getAllInvoices(date = null) {
    try {
      // Aplicar filtro de fecha
      await this.filterByDate(date);

      let allInvoices = [];
      let pageNumber = 1;

      do {
        logger.info(`Procesando página ${pageNumber}...`);

        const invoices = await this.extractInvoices();
        allInvoices = allInvoices.concat(invoices);

        const hasNext = await this.hasNextPage();

        if (!hasNext) break;

        await this.goToNextPage();
        pageNumber++;

      } while (pageNumber < 100); // Límite de seguridad

      logger.info(`✅ Total de facturas encontradas: ${allInvoices.length}`);
      return allInvoices;

    } catch (error) {
      logger.error(`Error obteniendo todas las facturas: ${error.message}`);
      throw error;
    }
  }
}

export default ScraperService;
