import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';
import fs from 'fs';
import path from 'path';

async function exploreSite() {
  console.log('🔍 Iniciando exploración del sitio MikroWISP...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  try {
    const page = await browser.newPage();

    // Configurar timeout de navegación más largo
    page.setDefaultNavigationTimeout(90000);

    // Paso 1: Ir a la página de login
    console.log('📍 Navegando a:', config.loginUrl);
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

    // Tomar screenshot del login
    await page.screenshot({ path: 'logs/01-login-page.png', fullPage: true });
    console.log('✅ Screenshot guardado: 01-login-page.png');

    // Paso 2: Intentar login
    console.log('\n🔐 Intentando login...');

    // Buscar los campos de usuario y password
    const usernameSelector = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const userInput = inputs.find(input =>
        input.type === 'text' ||
        input.type === 'email' ||
        input.name?.toLowerCase().includes('user') ||
        input.name?.toLowerCase().includes('email') ||
        input.placeholder?.toLowerCase().includes('user')
      );
      if (userInput) {
        return `input[name="${userInput.name}"]` || `input[type="${userInput.type}"]`;
      }
      return null;
    });

    const passwordSelector = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
      if (inputs.length > 0) {
        return inputs[0].name ? `input[name="${inputs[0].name}"]` : 'input[type="password"]';
      }
      return null;
    });

    console.log('Campo usuario encontrado:', usernameSelector);
    console.log('Campo password encontrado:', passwordSelector);

    if (usernameSelector && passwordSelector) {
      await page.type(usernameSelector, config.username);
      await page.type(passwordSelector, config.password);

      await page.screenshot({ path: 'logs/02-credentials-entered.png', fullPage: true });
      console.log('✅ Credenciales ingresadas');

      // Buscar y hacer click en el botón de login
      console.log('Buscando botón de login...');

      // Esperar a que el botón sea clickeable
      await page.waitForSelector('button', { timeout: 5000 });

      // Hacer click en el botón que contiene "Ingresar"
      const loginClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const loginBtn = buttons.find(btn =>
          btn.textContent?.includes('Ingresar')
        );
        if (loginBtn) {
          loginBtn.click();
          return true;
        }
        return false;
      });

      if (loginClicked) {
        console.log('✅ Click en botón de login ejecutado');

        // Esperar navegación
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });
        } catch (e) {
          console.log('⚠️  Timeout en waitForNavigation, continuando...');
        }

        await page.waitForTimeout(3000);

        // Verificar URL actual
        const currentUrl = page.url();
        console.log('📍 URL actual:', currentUrl);

        // Tomar screenshot solo si la página tiene contenido
        try {
          await page.screenshot({ path: 'logs/03-after-login.png', fullPage: true });
          console.log('✅ Screenshot guardado: 03-after-login.png');
        } catch (e) {
          console.log('⚠️  No se pudo tomar screenshot:', e.message);
        }

        // Paso 3: Buscar la sección de facturas/pagos
        console.log('\n🔍 Buscando sección de facturas...');

        const pageContent = await page.content();
        const links = await page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a, button, [role="menuitem"]'));
          return allLinks.map(link => ({
            text: link.textContent?.trim(),
            href: link.href || link.getAttribute('data-href') || '',
            classes: link.className
          })).filter(link => link.text);
        });

        console.log('\n📋 Menú/Enlaces encontrados:');
        links.forEach((link, index) => {
          if (link.text.length < 50) {
            console.log(`${index + 1}. ${link.text} -> ${link.href}`);
          }
        });

        // Buscar enlaces relacionados con facturas/pagos
        const invoiceLinks = links.filter(link =>
          link.text.toLowerCase().includes('factura') ||
          link.text.toLowerCase().includes('pago') ||
          link.text.toLowerCase().includes('recibo') ||
          link.text.toLowerCase().includes('invoice') ||
          link.text.toLowerCase().includes('payment')
        );

        if (invoiceLinks.length > 0) {
          console.log('\n💰 Enlaces de facturas/pagos encontrados:');
          invoiceLinks.forEach((link, index) => {
            console.log(`${index + 1}. ${link.text} -> ${link.href}`);
          });
        }

        // Esperar para inspección manual
        console.log('\n⏸️  Navegador permanecerá abierto durante 60 segundos para inspección manual...');
        console.log('Por favor, navega manualmente a la sección de recibos/facturas.');
        await page.waitForTimeout(60000);

      }
    } else {
      console.error('❌ No se encontraron los campos de login');
    }

  } catch (error) {
    console.error('❌ Error durante la exploración:', error.message);
    await browser.pages().then(pages => pages[0].screenshot({ path: 'logs/error.png' }));
  } finally {
    console.log('\n🔚 Exploración finalizada. Revisa las screenshots en la carpeta logs/');
    await browser.close();
  }
}

exploreSite();
