import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';
import fs from 'fs';
import path from 'path';

/**
 * Script manual para probar descarga de PDF paso a paso
 */

async function test() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  const downloadPath = path.resolve('./downloads/test-manual');

  // Crear carpeta de descargas
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }

  // Configurar descargas
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath
  });

  try {
    console.log('1. Login...');
    await page.goto(config.loginUrl);
    await page.waitForTimeout(2000);

    await page.type('input[name="usuario"]', config.username);
    await page.type('input[name="password"]', config.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    console.log('2. Navegando a facturas...');
    const url = page.url().replace(/#.*$/, '') + '#ajax/facturas';
    await page.goto(url);
    await page.waitForTimeout(8000);

    console.log('3. Haciendo click en el primer número de factura...');
    await page.evaluate(() => {
      const firstRow = document.querySelectorAll('table#facturas-cliente tbody tr')[0];
      const link = firstRow?.querySelector('td:first-child a');
      console.log('Link encontrado:', !!link);
      console.log('Link href:', link?.getAttribute('href'));
      console.log('Link onclick:', link?.getAttribute('onclick'));
      if (link) {
        link.click();
      }
    });

    console.log('4. Esperando 5 segundos para ver qué pasa...');
    await page.waitForTimeout(5000);

    console.log('5. Tomando screenshot...');
    await page.screenshot({ path: 'logs/manual-after-invoice-click.png', fullPage: true });

    console.log('6. Buscando elementos en la página...');
    const pageInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        // Buscar iframes
        iframes: document.querySelectorAll('iframe').length,
        // Buscar modales
        modals: Array.from(document.querySelectorAll('.modal, [role="dialog"], .ui-dialog')).map(m => ({
          visible: m.offsetParent !== null || window.getComputedStyle(m).display !== 'none',
          class: m.className,
          id: m.id
        })),
        // Buscar todos los botones visibles
        visibleButtons: Array.from(document.querySelectorAll('button, a')).filter(b => {
          const style = window.getComputedStyle(b);
          return b.offsetParent !== null && style.display !== 'none' && style.visibility !== 'hidden';
        }).length
      };
    });

    console.log('\\nInformación de la página:', JSON.stringify(pageInfo, null, 2));

    console.log('\\n7. ⏸️  PAUSA: El navegador permanecerá abierto.');
    console.log('   - Inspecciona manualmente lo que pasó');
    console.log('   - Busca el botón de imprimir/PDF');
    console.log('   - Haz click manualmente y observa');
    console.log('   - Presiona Ctrl+C para cerrar cuando termines\\n');

    // Mantener abierto indefinidamente
    await new Promise(() => {});

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'logs/manual-error.png' });
  }
}

test();
