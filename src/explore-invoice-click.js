import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';
import { logger } from './utils/logger.js';

/**
 * Script para explorar qué pasa al hacer click en una factura
 */

async function explore() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    // Login
    logger.info('Login...');
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.type('input[name="usuario"]', config.username);
    await page.type('input[name="password"]', config.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);

    // Ir a facturas
    logger.info('Navegando a facturas...');
    const url = page.url().replace(/#.*$/, '') + '#ajax/facturas';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    // Analizar la primera fila
    logger.info('Analizando primera fila de la tabla...');
    const rowInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('table#facturas-cliente tbody tr');
      const firstRow = rows[0];

      if (!firstRow) return { error: 'No se encontró primera fila' };

      const cells = firstRow.querySelectorAll('td');
      const invoiceNumberCell = cells[0];

      return {
        totalRows: rows.length,
        cellsInFirstRow: cells.length,
        invoiceNumber: invoiceNumberCell?.textContent?.trim(),
        hasLink: !!invoiceNumberCell?.querySelector('a'),
        linkHref: invoiceNumberCell?.querySelector('a')?.getAttribute('href'),
        linkOnclick: invoiceNumberCell?.querySelector('a')?.getAttribute('onclick'),
        // Buscar botones/iconos en la última celda (acciones)
        lastCellHTML: cells[cells.length - 1]?.innerHTML,
        // Buscar todos los botones en la fila
        buttonsInRow: Array.from(firstRow.querySelectorAll('button, a[href], i[onclick]')).map(btn => ({
          tag: btn.tagName,
          class: btn.className,
          title: btn.getAttribute('title'),
          onclick: btn.getAttribute('onclick'),
          href: btn.getAttribute('href'),
          text: btn.textContent?.trim().substring(0, 30)
        }))
      };
    });

    logger.info('Información de la fila:', rowInfo);

    // Hacer click en el número de factura y ver qué pasa
    logger.info('\\nHaciendo click en número de factura...');
    await page.evaluate(() => {
      const firstRow = document.querySelectorAll('table#facturas-cliente tbody tr')[0];
      const link = firstRow.querySelector('td:first-child a');
      if (link) {
        link.click();
      }
    });

    // Esperar y analizar qué cambió
    await page.waitForTimeout(3000);

    const afterClick = await page.evaluate(() => {
      // Buscar modales, ventanas emergentes, etc.
      return {
        modals: Array.from(document.querySelectorAll('.modal, [role="dialog"]')).map(m => ({
          visible: m.offsetParent !== null,
          class: m.className,
          content: m.textContent?.substring(0, 100)
        })),
        // Buscar botones de imprimir visibles
        printButtons: Array.from(document.querySelectorAll('button, a')).filter(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const title = btn.getAttribute('title')?.toLowerCase() || '';
          const onclick = btn.getAttribute('onclick')?.toLowerCase() || '';
          return (text.includes('imprimir') ||
                  text.includes('pdf') ||
                  title.includes('imprimir') ||
                  onclick?.includes('print')) &&
                 btn.offsetParent !== null;
        }).map(btn => ({
          tag: btn.tagName,
          text: btn.textContent?.trim(),
          class: btn.className,
          title: btn.getAttribute('title'),
          onclick: btn.getAttribute('onclick')
        })),
        url: window.location.href
      };
    });

    logger.info('\\nDespués del click:', afterClick);

    logger.info('\\n✅ Exploración completa. Navegador permanecerá abierto 60s...');
    await page.waitForTimeout(60000);

  } catch (error) {
    logger.error('Error:', error.message);
    await page.screenshot({ path: 'logs/explore-error.png' });
  } finally {
    await browser.close();
  }
}

explore();
