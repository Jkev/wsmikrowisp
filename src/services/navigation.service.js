import { logger } from '../utils/logger.js';
import { selectors, searchTexts, waitConfig } from '../config/selectors.js';

/**
 * Servicio de navegación dentro de MikroWISP
 */
export class NavigationService {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navega a la sección de Facturas
   */
  async navigateToFacturas() {
    try {
      logger.info('Navegando a Facturas...');

      // Ir directamente a la URL de facturas (más rápido y confiable)
      const facturasUrl = this.page.url().replace(/#.*$/, '') + '#ajax/facturas';
      logger.info(`Navegando directamente a: ${facturasUrl}`);

      await this.page.goto(facturasUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Esperar a que cargue la vista de facturas
      logger.info('Esperando a que cargue la vista de facturas...');
      await this.page.waitForTimeout(5000);

      // Esperar a que desaparezcan loaders
      await this.waitForPageLoad();

      logger.info('✅ Navegación exitosa a Facturas');
      return true;

    } catch (error) {
      logger.error(`Error en navegación: ${error.message}`);
      throw error;
    }
  }

  /**
   * Navega a la sección de Transacciones
   */
  async navigateToTransacciones() {
    try {
      logger.info('Navegando a Transacciones...');

      // Ir directamente a la URL de transacciones
      const transaccionesUrl = this.page.url().replace(/#.*$/, '') + '#ajax/transacciones';
      logger.info(`Navegando directamente a: ${transaccionesUrl}`);

      await this.page.goto(transaccionesUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Esperar a que cargue la vista de transacciones
      logger.info('Esperando a que cargue la vista de transacciones...');
      await this.page.waitForTimeout(5000);

      // Esperar a que desaparezcan loaders
      await this.waitForPageLoad();

      logger.info('✅ Navegación exitosa a Transacciones');
      return true;

    } catch (error) {
      logger.error(`Error en navegación: ${error.message}`);
      throw error;
    }
  }

  /**
   * Hace click en un elemento que contenga cierto texto
   */
  async clickElementByText(possibleTexts) {
    const texts = Array.isArray(possibleTexts) ? possibleTexts : [possibleTexts];

    return await this.page.evaluate((textOptions) => {
      const allElements = Array.from(document.querySelectorAll('*'));

      for (const searchText of textOptions) {
        // Buscar coincidencias exactas primero
        let element = allElements.find(el => {
          const text = el.textContent?.trim() || '';
          const isExactMatch = text === searchText;
          const isVisible = el.offsetParent !== null;
          const isClickable = el.tagName === 'A' ||
                             el.tagName === 'BUTTON' ||
                             el.tagName === 'LI' ||
                             el.tagName === 'SPAN' ||
                             el.tagName === 'DIV' ||
                             el.onclick !== null ||
                             window.getComputedStyle(el).cursor === 'pointer';
          return isExactMatch && isVisible && isClickable;
        });

        // Si no hay coincidencia exacta, buscar que contenga el texto
        if (!element) {
          element = allElements.find(el => {
            const text = el.textContent?.trim() || '';
            const isMatch = text.includes(searchText) && text.length < 100;
            const isVisible = el.offsetParent !== null;
            const isClickable = el.tagName === 'A' ||
                               el.tagName === 'BUTTON' ||
                               el.tagName === 'LI' ||
                               el.tagName === 'SPAN' ||
                               el.tagName === 'DIV' ||
                               el.onclick !== null;
            return isMatch && isVisible && isClickable;
          });
        }

        if (element) {
          console.log(`✓ Encontrado: ${element.tagName} con texto "${element.textContent?.trim().substring(0, 50)}"`);
          element.click();
          return true;
        }
      }

      console.log(`✗ No se encontró ningún elemento con los textos: ${textOptions.join(', ')}`);
      return false;
    }, texts);
  }

  /**
   * Espera a que la página termine de cargar
   */
  async waitForPageLoad() {
    try {
      // Esperar a que desaparezcan los spinners/loaders
      await this.page.waitForFunction(
        (loaderSelector) => {
          const spinners = document.querySelectorAll(loaderSelector);
          return spinners.length === 0 || Array.from(spinners).every(s =>
            s.style.display === 'none' ||
            s.style.visibility === 'hidden' ||
            !s.offsetParent
          );
        },
        { timeout: 30000 },
        selectors.facturas.loader
      ).catch(() => logger.warn('Timeout esperando que desaparezcan loaders'));

      await this.page.waitForTimeout(waitConfig.forTableLoad);

    } catch (error) {
      logger.warn(`Error esperando carga de página: ${error.message}`);
    }
  }

  /**
   * Espera a que aparezca un elemento
   */
  async waitForElement(selector, timeout = waitConfig.forElement) {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      logger.warn(`Elemento ${selector} no encontrado en ${timeout}ms`);
      return false;
    }
  }

  /**
   * Toma un screenshot para debugging
   */
  async takeScreenshot(name) {
    try {
      const filename = `logs/${name}-${Date.now()}.png`;
      await this.page.screenshot({ path: filename, fullPage: false });
      logger.debug(`Screenshot guardado: ${filename}`);
      return filename;
    } catch (error) {
      logger.warn(`Error tomando screenshot: ${error.message}`);
      return null;
    }
  }
}

export default NavigationService;
