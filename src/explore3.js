import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';

async function exploreSite() {
  console.log('🔍 Iniciando exploración del sitio MikroWISP (v3)...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
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

    console.log('👆 Haciendo click en "Ingresar al Administrador"...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const loginBtn = buttons.find(btn => btn.textContent?.includes('Ingresar'));
      if (loginBtn) loginBtn.click();
    });

    await page.waitForTimeout(5000);
    console.log('✅ Login exitoso. URL:', page.url());

    // PASO 2: ESPERAR A QUE CARGUE EL DASHBOARD
    console.log('\n📍 PASO 2: Esperando a que cargue el dashboard...');

    // Esperar a que desaparezca cualquier spinner o loader
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('[class*="spinner"], [class*="loader"], [class*="loading"]');
      return spinners.length === 0 || Array.from(spinners).every(s => s.style.display === 'none');
    }, { timeout: 20000 }).catch(() => console.log('⚠️  Timeout esperando spinners, continuando...'));

    await page.waitForTimeout(3000);
    console.log('✅ Dashboard cargado');

    // PASO 3: BUSCAR Y ABRIR MENÚ DE FINANZAS
    console.log('\n📍 PASO 3: Buscando menú de Finanzas en la barra lateral...');

    const finanzasFound = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const finanzasElement = allElements.find(el =>
        el.textContent?.trim() === 'Finanzas' &&
        (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'DIV' || el.tagName === 'LI' || el.tagName === 'SPAN')
      );

      if (finanzasElement) {
        finanzasElement.click();
        return true;
      }
      return false;
    });

    if (!finanzasFound) {
      console.log('❌ No se encontró "Finanzas", listando elementos del menú...');
      const menuItems = await page.evaluate(() => {
        const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="menu"]');
        if (sidebar) {
          const links = Array.from(sidebar.querySelectorAll('a, button, li, span'));
          return links.map(el => el.textContent?.trim()).filter(text => text && text.length < 50 && text.length > 0);
        }
        return [];
      });
      console.log('Elementos del menú:', menuItems.slice(0, 20));
      await browser.close();
      return;
    }

    console.log('✅ Click en "Finanzas" ejecutado');
    await page.waitForTimeout(2000);

    // PASO 4: BUSCAR Y HACER CLICK EN "FACTURAS"
    console.log('\n📍 PASO 4: Buscando submenu "Facturas"...');

    const facturasFound = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const facturasElement = allElements.find(el =>
        el.textContent?.trim() === 'Facturas' &&
        (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'LI' || el.tagName === 'SPAN')
      );

      if (facturasElement) {
        facturasElement.click();
        return true;
      }
      return false;
    });

    if (!facturasFound) {
      console.log('❌ No se encontró "Facturas"');
      await browser.close();
      return;
    }

    console.log('✅ Click en "Facturas" ejecutado');

    // ESPERAR A QUE CARGUE LA VISTA DE FACTURAS
    console.log('⏳ Esperando a que cargue la vista de facturas...');

    // Esperar a que desaparezca el spinner
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('[class*="spinner"], [class*="loader"], [class*="loading"]');
      return spinners.length === 0 || Array.from(spinners).every(s =>
        s.style.display === 'none' ||
        s.style.visibility === 'hidden' ||
        !s.offsetParent
      );
    }, { timeout: 30000 }).catch(() => console.log('⚠️  Timeout esperando que cargue facturas'));

    await page.waitForTimeout(5000);

    console.log('📍 URL actual:', page.url());
    await page.screenshot({ path: 'logs/facturas-loaded.png', fullPage: true });

    // PASO 5: ANALIZAR LA PÁGINA DE FACTURAS
    console.log('\n📍 PASO 5: Analizando la página de facturas...');

    const pageInfo = await page.evaluate(() => {
      const info = {
        url: window.location.href,
        title: document.title,
        dateInputs: [],
        buttons: [],
        tables: 0,
        rows: 0,
        pdfLinks: [],
        allInputs: []
      };

      // Buscar TODOS los inputs
      const allInputs = document.querySelectorAll('input');
      allInputs.forEach(input => {
        info.allInputs.push({
          type: input.type,
          name: input.name || '',
          id: input.id || '',
          placeholder: input.placeholder || '',
          className: input.className || ''
        });
      });

      // Buscar inputs de fecha
      const dateInputs = document.querySelectorAll('input[type="date"], input[type="text"]');
      dateInputs.forEach(input => {
        const text = input.placeholder?.toLowerCase() || input.name?.toLowerCase() || '';
        if (text.includes('fecha') || text.includes('date')) {
          info.dateInputs.push({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
          });
        }
      });

      // Buscar botones
      const buttons = document.querySelectorAll('button');
      buttons.forEach(btn => {
        const text = btn.textContent?.trim();
        if (text && text.length < 50) {
          info.buttons.push(text);
        }
      });

      // Contar tablas y filas
      const tables = document.querySelectorAll('table');
      info.tables = tables.length;
      tables.forEach(table => {
        info.rows += table.querySelectorAll('tr').length;
      });

      // Buscar enlaces a PDF o botones de descarga
      const allLinks = document.querySelectorAll('a, button');
      allLinks.forEach(link => {
        const href = link.href || '';
        const text = link.textContent?.trim() || '';
        const hasIcon = link.querySelector('[class*="pdf"], [class*="download"], svg, i');

        if (href.includes('pdf') || href.includes('PDF') ||
            text.includes('PDF') || text.includes('Descargar') ||
            text.includes('Imprimir') || hasIcon) {
          info.pdfLinks.push({
            href: href,
            text: text.substring(0, 100),
            tag: link.tagName
          });
        }
      });

      return info;
    });

    console.log('\n📊 Información de la página de facturas:');
    console.log('URL:', pageInfo.url);
    console.log('Título:', pageInfo.title);
    console.log('\n📝 TODOS los inputs encontrados:', pageInfo.allInputs.length);
    pageInfo.allInputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}, Name: "${input.name}", ID: "${input.id}", Placeholder: "${input.placeholder}"`);
    });

    console.log('\n📅 Inputs de fecha encontrados:', pageInfo.dateInputs.length);
    pageInfo.dateInputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}`);
    });

    console.log('\n🔘 Botones encontrados:', pageInfo.buttons.length);
    pageInfo.buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. ${btn}`);
    });

    console.log('\n📋 Tablas:', pageInfo.tables, '| Filas totales:', pageInfo.rows);

    console.log('\n📄 Enlaces/Botones de PDF encontrados:', pageInfo.pdfLinks.length);
    pageInfo.pdfLinks.slice(0, 10).forEach((link, i) => {
      console.log(`  ${i + 1}. [${link.tag}] ${link.text} -> ${link.href}`);
    });

    // Obtener el HTML de la página para análisis
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log('\n💾 Guardando HTML de la página...');
    const fs = await import('fs');
    fs.writeFileSync('logs/facturas-page.html', bodyHTML);
    console.log('✅ HTML guardado en logs/facturas-page.html');

    // Esperar para inspección manual
    console.log('\n⏸️  Navegador permanecerá abierto durante 60 segundos para inspección manual...');
    console.log('Por favor, inspecciona la página de facturas y navega manualmente si es necesario.');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ Error durante la exploración:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n🔚 Exploración finalizada.');
    await browser.close();
  }
}

exploreSite();
