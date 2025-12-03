import puppeteer from 'puppeteer';
import { logger } from './utils/logger.js';
import { getTodayDateFormatted } from './utils/helpers.js';
import AuthService from './services/auth.service.js';

/**
 * Script para explorar la estructura del datepicker de MikroWISP
 */

async function exploreDatepicker() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);

  // Capturar console.log del navegador
  page.on('console', msg => {
    const text = msg.text();
    logger.info(`[Browser] ${text}`);
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    // 1. Login
    logger.info('🔐 Iniciando login...');
    const authService = new AuthService(page);
    await authService.login();
    logger.info('✅ Login exitoso');

    // 2. Navegar a Transacciones
    logger.info('📊 Navegando a Transacciones...');
    const transaccionesUrl = page.url().replace(/#.*$/, '') + '#ajax/transacciones';
    await page.goto(transaccionesUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    logger.info('✅ Página de transacciones cargada');

    // 3. Fecha actual
    const formattedDate = getTodayDateFormatted();
    const dayOfMonth = formattedDate.split('/')[0];
    logger.info(`📅 Buscando día: ${dayOfMonth} (${formattedDate})`);

    // 4. Esperar a que existan los inputs
    await page.waitForSelector('#desde', { timeout: 10000 });
    await page.waitForSelector('#hasta', { timeout: 10000 });
    logger.info('✓ Inputs #desde y #hasta encontrados');

    // 5. Click en el input "desde" para abrir el datepicker
    logger.info('🗓️ Abriendo datepicker...');
    await page.click('#desde');
    await page.waitForTimeout(2000); // Esperar a que se abra el calendario

    // 6. EXPLORAR TODA LA ESTRUCTURA DEL DATEPICKER
    logger.info('\n📋 EXPLORANDO ESTRUCTURA DEL DATEPICKER:\n');

    const datepickerStructure = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const datepickerRelated = [];

      // Buscar elementos que probablemente pertenezcan al datepicker
      allElements.forEach(el => {
        const classes = String(el.className || '');
        const id = el.id;
        const tagName = el.tagName;
        const text = el.textContent?.trim().substring(0, 50);

        // Filtrar elementos que probablemente sean del datepicker
        if (
          classes.includes('date') ||
          classes.includes('picker') ||
          classes.includes('calendar') ||
          classes.includes('day') ||
          classes.includes('month') ||
          classes.includes('year') ||
          tagName === 'TD' && text && /^\d{1,2}$/.test(text) // celdas con números
        ) {
          datepickerRelated.push({
            tag: tagName,
            id: id || 'sin-id',
            className: classes || 'sin-class',
            text: text || 'sin-texto',
            visible: el.offsetParent !== null
          });
        }
      });

      return datepickerRelated;
    });

    logger.info('📊 Elementos relacionados con datepicker encontrados:');
    datepickerStructure.forEach((el, index) => {
      logger.info(`  [${index}] <${el.tag}> class="${el.className}" id="${el.id}" text="${el.text}" visible=${el.visible}`);
    });

    // 7. Buscar específicamente TDs con números (días del mes)
    logger.info('\n🔢 EXPLORANDO TDs CON NÚMEROS (días del mes):\n');

    const dayElements = await page.evaluate(() => {
      const tds = document.querySelectorAll('td');
      const days = [];

      tds.forEach((td, index) => {
        const text = td.textContent?.trim();
        if (/^\d{1,2}$/.test(text)) {
          days.push({
            index,
            text,
            className: td.className,
            id: td.id || 'sin-id',
            dataDate: td.getAttribute('data-date') || 'sin-data-date',
            dataDay: td.getAttribute('data-day') || 'sin-data-day',
            classList: Array.from(td.classList),
            parent: td.parentElement?.tagName || 'sin-parent',
            visible: td.offsetParent !== null,
            disabled: td.classList.contains('disabled') || td.classList.contains('old') || td.classList.contains('new')
          });
        }
      });

      return days;
    });

    logger.info(`📊 ${dayElements.length} celdas de días encontradas:\n`);
    dayElements.forEach((day, idx) => {
      logger.info(`  [${idx}] Día "${day.text}" - Classes: [${day.classList.join(', ')}] - Disabled: ${day.disabled} - Visible: ${day.visible}`);
      if (day.dataDate !== 'sin-data-date') {
        logger.info(`       data-date="${day.dataDate}"`);
      }
      if (day.dataDay !== 'sin-data-day') {
        logger.info(`       data-day="${day.dataDay}"`);
      }
    });

    // 8. Intentar encontrar el día específico que buscamos
    logger.info(`\n🎯 Buscando día específico: "${dayOfMonth}"\n`);

    const targetDayInfo = dayElements.find(day => {
      return day.text === dayOfMonth && !day.disabled;
    });

    if (targetDayInfo) {
      logger.info(`✅ Día "${dayOfMonth}" ENCONTRADO:`);
      logger.info(`   Index: ${targetDayInfo.index}`);
      logger.info(`   Classes: [${targetDayInfo.classList.join(', ')}]`);
      logger.info(`   Disabled: ${targetDayInfo.disabled}`);
      logger.info(`   Visible: ${targetDayInfo.visible}`);
    } else {
      logger.error(`❌ Día "${dayOfMonth}" NO ENCONTRADO`);
    }

    logger.info('\n✅ Exploración completada. El navegador permanecerá abierto para inspección manual.');
    logger.info('   Presiona Ctrl+C para cerrar.\n');

    // Mantener el navegador abierto
    await new Promise(() => {});

  } catch (error) {
    logger.error('❌ Error en la exploración:', error);
    throw error;
  }
}

// Ejecutar
exploreDatepicker()
  .then(() => logger.info('Script finalizado'))
  .catch((error) => {
    logger.error('Error fatal:', error);
    process.exit(1);
  });
