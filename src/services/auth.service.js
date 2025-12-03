import { logger } from '../utils/logger.js';
import { config } from '../config/credentials.js';

/**
 * Servicio de autenticación para MikroWISP
 */
export class AuthService {
  constructor(page) {
    this.page = page;
  }

  /**
   * Realiza el login en MikroWISP
   */
  async login() {
    try {
      logger.info('Iniciando login en MikroWISP...');

      // Navegar a la página de login
      await this.page.goto(config.loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: config.navigationTimeout
      });

      await this.page.waitForTimeout(2000);

      // Esperar a que los campos de login estén disponibles
      await this.page.waitForSelector('input[name="mail"]', { timeout: 10000 });

      // Ingresar credenciales
      await this.page.type('input[name="mail"]', config.username);
      await this.page.type('input[name="password"]', config.password);

      logger.info('Credenciales ingresadas');

      // Hacer click en el botón de login
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const loginBtn = buttons.find(btn =>
          btn.textContent?.includes('Ingresar') ||
          btn.textContent?.includes('Login')
        );
        if (loginBtn) {
          loginBtn.click();
        } else {
          throw new Error('Botón de login no encontrado');
        }
      });

      // Esperar a que la navegación complete
      await this.page.waitForTimeout(5000);

      // Verificar que el login fue exitoso
      const currentUrl = this.page.url();
      if (currentUrl.includes('/admin')) {
        logger.info('✅ Login exitoso');
        return true;
      } else {
        throw new Error('Login falló - URL no cambió a /admin');
      }

    } catch (error) {
      logger.error(`Error durante el login: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verifica si la sesión sigue activa
   */
  async isAuthenticated() {
    try {
      const url = this.page.url();
      return url.includes('/admin') && !url.includes('/login');
    } catch (error) {
      return false;
    }
  }

  /**
   * Cierra la sesión
   */
  async logout() {
    try {
      logger.info('Cerrando sesión...');

      // Buscar y hacer click en botón de logout
      const loggedOut = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button'));
        const logoutElement = allElements.find(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('logout') ||
                 text.includes('cerrar sesión') ||
                 text.includes('salir');
        });

        if (logoutElement) {
          logoutElement.click();
          return true;
        }
        return false;
      });

      if (loggedOut) {
        await this.page.waitForTimeout(2000);
        logger.info('✅ Sesión cerrada');
      }

      return loggedOut;
    } catch (error) {
      logger.warn(`Error al cerrar sesión: ${error.message}`);
      return false;
    }
  }
}

export default AuthService;
