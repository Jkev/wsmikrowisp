import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';

/**
 * Script de prueba para navegación a Facturas
 * Basado en las capturas proporcionadas
 */

async function testNavigation() {
  console.log('🧪 Probando navegación a Facturas...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();

    // LOGIN
    console.log('1️⃣ Login...');
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.type('input[name="mail"]', config.username);
    await page.type('input[name="password"]', config.password);

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.find(btn => btn.textContent?.includes('Ingresar'))?.click();
    });

    console.log('2️⃣ Esperando dashboard...');
    await page.waitForTimeout(10000);

    console.log('📍 URL actual:', page.url());

    // NAVEGACIÓN A FINANZAS
    console.log('\n3️⃣ Haciendo click en "Finanzas"...');

    // Intentar hacer click en el elemento Finanzas
    const finanzasClicked = await page.evaluate(() => {
      // Buscar el elemento que contiene exactamente "Finanzas"
      const allElements = Array.from(document.querySelectorAll('*'));

      for (const el of allElements) {
        const text = el.textContent?.trim();

        // Buscar elemento con texto "Finanzas" que no sea demasiado largo
        if (text === 'Finanzas' || (text?.startsWith('Finanzas') && text.length < 30)) {
          // Verificar que sea clickeable
          const isClickable = el.tagName === 'A' ||
                              el.tagName === 'BUTTON' ||
                              el.tagName === 'DIV' ||
                              el.tagName === 'LI' ||
                              el.onclick ||
                              window.getComputedStyle(el).cursor === 'pointer';

          if (isClickable) {
            console.log('Encontrado Finanzas:', el.tagName, el.className);
            el.click();
            return true;
          }
        }
      }

      return false;
    });

    if (!finanzasClicked) {
      console.log('❌ No se encontró el elemento Finanzas');

      // Listar todos los elementos visibles del menú
      const menuItems = await page.evaluate(() => {
        const sidebar = document.querySelector('aside, nav, [class*="sidebar"], [class*="menu"]');
        if (sidebar) {
          return Array.from(sidebar.querySelectorAll('a, button, li, div'))
            .map(el => ({
              tag: el.tagName,
              text: el.textContent?.trim().substring(0, 50),
              class: el.className
            }))
            .filter(item => item.text && item.text.length > 0 && item.text.length < 50);
        }
        return [];
      });

      console.log('\n📋 Elementos del menú encontrados:');
      menuItems.forEach((item, i) => {
        console.log(`${i + 1}. [${item.tag}] ${item.text}`);
      });

      await page.screenshot({ path: 'logs/menu-not-found.png' });
      await browser.close();
      return;
    }

    console.log('✅ Click en Finanzas ejecutado');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'logs/after-finanzas-click.png' });

    // NAVEGACIÓN A FACTURAS
    console.log('\n4️⃣ Haciendo click en "Facturas"...');

    const facturasClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));

      for (const el of allElements) {
        const text = el.textContent?.trim();

        if (text === 'Facturas') {
          const isClickable = el.tagName === 'A' ||
                              el.tagName === 'BUTTON' ||
                              el.tagName === 'LI' ||
                              el.onclick ||
                              window.getComputedStyle(el).cursor === 'pointer';

          if (isClickable) {
            console.log('Encontrado Facturas:', el.tagName, el.className);
            el.click();
            return true;
          }
        }
      }

      return false;
    });

    if (!facturasClicked) {
      console.log('❌ No se encontró el elemento Facturas');
      await page.screenshot({ path: 'logs/facturas-not-found.png' });
      await browser.close();
      return;
    }

    console.log('✅ Click en Facturas ejecutado');
    console.log('\n5️⃣ Esperando que cargue la vista de facturas (15s)...');
    await page.waitForTimeout(15000);

    await page.screenshot({ path: 'logs/facturas-view.png', fullPage: true });

    // ANALIZAR LA VISTA DE FACTURAS
    console.log('\n6️⃣ Analizando la vista de facturas...');

    const pageAnalysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,

        // Todos los inputs
        inputs: Array.from(document.querySelectorAll('input')).map(inp => ({
          type: inp.type,
          name: inp.name || '',
          id: inp.id || '',
          placeholder: inp.placeholder || '',
          class: inp.className || ''
        })),

        // Todos los botones
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim().substring(0, 100) || '',
          class: btn.className || '',
          id: btn.id || ''
        })),

        // Tablas
        tables: Array.from(document.querySelectorAll('table')).map((table, i) => ({
          index: i,
          class: table.className,
          rows: table.querySelectorAll('tbody tr').length,
          headers: Array.from(table.querySelectorAll('thead th')).map(th => th.textContent?.trim())
        })),

        // Selectores que podrían ser útiles
        hasDatePicker: !!document.querySelector('[class*="date"], [class*="picker"]'),
        hasFilterButton: !!document.querySelector('button[class*="filter"], button[class*="search"]')
      };
    });

    console.log('\n📊 ANÁLISIS DE LA PÁGINA DE FACTURAS:');
    console.log('='.repeat(60));
    console.log('URL:', pageAnalysis.url);
    console.log('Título:', pageAnalysis.title);

    console.log('\n📝 INPUTS (' + pageAnalysis.inputs.length + '):');
    pageAnalysis.inputs.forEach((inp, i) => {
      console.log(`  ${i + 1}. [${inp.type}] name="${inp.name}" id="${inp.id}" placeholder="${inp.placeholder}"`);
    });

    console.log('\n🔘 BOTONES (' + pageAnalysis.buttons.length + '):');
    pageAnalysis.buttons.slice(0, 20).forEach((btn, i) => {
      console.log(`  ${i + 1}. "${btn.text}" (class: ${btn.class})`);
    });

    console.log('\n📋 TABLAS (' + pageAnalysis.tables.length + '):');
    pageAnalysis.tables.forEach((table, i) => {
      console.log(`  ${i + 1}. ${table.rows} filas, Headers: [${table.headers.join(', ')}]`);
    });

    console.log('\n🔍 DETECTADOS:');
    console.log('  Date Picker:', pageAnalysis.hasDatePicker ? '✅' : '❌');
    console.log('  Filter Button:', pageAnalysis.hasFilterButton ? '✅' : '❌');

    console.log('\n💾 Guardando HTML...');
    const html = await page.content();
    const fs = await import('fs');
    fs.writeFileSync('logs/facturas-page.html', html);
    console.log('✅ HTML guardado en logs/facturas-page.html');

    console.log('\n⏸️  Navegador permanecerá abierto 60 segundos para inspección...');
    console.log('Usa este tiempo para:');
    console.log('  - Inspeccionar manualmente la tabla');
    console.log('  - Probar filtros de fecha');
    console.log('  - Identificar el botón de descarga PDF');
    console.log('  - Tomar nota de los selectores necesarios\n');

    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Test completado');
  }
}

testNavigation();
