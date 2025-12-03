import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';

async function exploreSite() {
  console.log('🔍 Iniciando exploración del sitio MikroWISP (v2)...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(90000);

    // PASO 1: LOGIN
    console.log('📍 PASO 1: Navegando al login...');
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    console.log('🔐 Ingresando credenciales...');
    await page.type('input[name="mail"]', config.username);
    await page.type('input[name="password"]', config.password);

    await page.screenshot({ path: 'logs/step1-credentials.png', fullPage: true });

    console.log('👆 Haciendo click en "Ingresar al Administrador"...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginBtn = buttons.find(btn => btn.textContent?.includes('Ingresar'));
      if (loginBtn) loginBtn.click();
    });

    // Esperar a que cargue el dashboard
    await page.waitForTimeout(5000);
    console.log('✅ Login exitoso. URL:', page.url());

    // PASO 2: BUSCAR Y ABRIR MENÚ DE FINANZAS
    console.log('\n📍 PASO 2: Buscando menú de Finanzas en la barra lateral...');
    await page.waitForTimeout(5000); // Esperar a que cargue la interfaz

    // Tomar screenshot del dashboard (con manejo de errores)
    try {
      await page.screenshot({ path: 'logs/step2-dashboard.png' });
      console.log('✅ Screenshot del dashboard guardado');
    } catch (e) {
      console.log('⚠️  No se pudo tomar screenshot del dashboard, continuando...');
    }

    // Buscar el menú "Finanzas"
    const finanzasFound = await page.evaluate(() => {
      // Buscar en la barra lateral
      const allElements = Array.from(document.querySelectorAll('*'));
      const finanzasElement = allElements.find(el =>
        (el.textContent?.trim() === 'Finanzas' ||
         el.textContent?.includes('Finanzas')) &&
        (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'DIV' || el.tagName === 'LI')
      );

      if (finanzasElement) {
        console.log('Encontrado elemento de Finanzas:', finanzasElement.tagName, finanzasElement.className);
        finanzasElement.click();
        return true;
      }
      return false;
    });

    if (finanzasFound) {
      console.log('✅ Click en "Finanzas" ejecutado');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'logs/step3-finanzas-open.png', fullPage: true });

      // PASO 3: BUSCAR Y HACER CLICK EN "FACTURAS"
      console.log('\n📍 PASO 3: Buscando submenu "Facturas"...');

      const facturasFound = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const facturasElement = allElements.find(el =>
          (el.textContent?.trim() === 'Facturas' ||
           el.textContent?.includes('Facturas')) &&
          (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'LI')
        );

        if (facturasElement) {
          console.log('Encontrado elemento de Facturas:', facturasElement.tagName, facturasElement.className);
          facturasElement.click();
          return true;
        }
        return false;
      });

      if (facturasFound) {
        console.log('✅ Click en "Facturas" ejecutado');
        await page.waitForTimeout(3000);

        console.log('📍 URL actual:', page.url());
        await page.screenshot({ path: 'logs/step4-facturas-page.png', fullPage: true });

        // PASO 4: ANALIZAR LA PÁGINA DE FACTURAS
        console.log('\n📍 PASO 4: Analizando la página de facturas...');

        // Buscar controles de fecha y filtros
        const pageInfo = await page.evaluate(() => {
          const info = {
            url: window.location.href,
            dateInputs: [],
            buttons: [],
            tables: 0,
            pdfLinks: []
          };

          // Buscar inputs de fecha
          const dateInputs = document.querySelectorAll('input[type="date"], input[type="text"][placeholder*="fecha"], input[name*="date"], input[name*="fecha"]');
          dateInputs.forEach(input => {
            info.dateInputs.push({
              type: input.type,
              name: input.name,
              id: input.id,
              placeholder: input.placeholder,
              value: input.value
            });
          });

          // Buscar botones relevantes
          const buttons = document.querySelectorAll('button');
          buttons.forEach(btn => {
            const text = btn.textContent?.trim();
            if (text && text.length < 50) {
              info.buttons.push(text);
            }
          });

          // Contar tablas
          info.tables = document.querySelectorAll('table').length;

          // Buscar enlaces a PDF
          const links = document.querySelectorAll('a');
          links.forEach(link => {
            const href = link.href || '';
            const text = link.textContent?.trim();
            if (href.includes('pdf') || href.includes('PDF') || text?.includes('PDF') || text?.includes('Descargar')) {
              info.pdfLinks.push({
                href: href,
                text: text
              });
            }
          });

          return info;
        });

        console.log('\n📊 Información de la página de facturas:');
        console.log('URL:', pageInfo.url);
        console.log('Inputs de fecha encontrados:', pageInfo.dateInputs.length);
        pageInfo.dateInputs.forEach((input, i) => {
          console.log(`  ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
        });
        console.log('\nBotones encontrados:', pageInfo.buttons.slice(0, 20));
        console.log('Tablas encontradas:', pageInfo.tables);
        console.log('Enlaces a PDF encontrados:', pageInfo.pdfLinks.length);
        if (pageInfo.pdfLinks.length > 0) {
          console.log('Primeros enlaces PDF:');
          pageInfo.pdfLinks.slice(0, 5).forEach((link, i) => {
            console.log(`  ${i + 1}. ${link.text} -> ${link.href}`);
          });
        }

        // Esperar para inspección manual
        console.log('\n⏸️  Navegador permanecerá abierto durante 60 segundos para inspección manual...');
        await page.waitForTimeout(60000);

      } else {
        console.log('❌ No se encontró el elemento "Facturas"');
      }

    } else {
      console.log('❌ No se encontró el elemento "Finanzas"');

      // Listar todos los elementos de la barra lateral
      const sidebarElements = await page.evaluate(() => {
        const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="menu"]');
        if (sidebar) {
          const links = Array.from(sidebar.querySelectorAll('a, button, li'));
          return links.map(el => el.textContent?.trim()).filter(text => text && text.length < 50);
        }
        return [];
      });

      console.log('\n📋 Elementos encontrados en la barra lateral:');
      sidebarElements.forEach((text, i) => {
        console.log(`${i + 1}. ${text}`);
      });
    }

  } catch (error) {
    console.error('❌ Error durante la exploración:', error.message);
    try {
      const pages = await browser.pages();
      if (pages[0]) {
        await pages[0].screenshot({ path: 'logs/error.png' });
      }
    } catch (e) {
      console.log('No se pudo tomar screenshot del error');
    }
  } finally {
    console.log('\n🔚 Exploración finalizada.');
    await browser.close();
  }
}

exploreSite();
