import puppeteer from 'puppeteer';
import { logger } from './utils/logger.js';
import { getYesterdayDateFormatted } from './utils/helpers.js';
import AuthService from './services/auth.service.js';

/**
 * Script de prueba para verificar que los filtros de fecha se configuran correctamente
 */

async function testDateFilter() {
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
    // Obtener fecha de ayer en formato DD/MM/YYYY
    const yesterdayDate = getYesterdayDateFormatted();
    logger.info(`📅 Fecha objetivo (día anterior): ${yesterdayDate}`);

    // 1. Login
    logger.info('🔐 Iniciando login...');
    const authService = new AuthService(page);
    await authService.login();
    logger.info('✅ Login exitoso\n');

    // 2. Navegar a Transacciones
    logger.info('📊 Navegando a Transacciones...');
    const transaccionesUrl = page.url().replace(/#.*$/, '') + '#ajax/transacciones';
    await page.goto(transaccionesUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    logger.info('✅ Página de transacciones cargada\n');

    // 3. Verificar TODOS los inputs (texto, date, etc.)
    logger.info('🔍 VERIFICANDO TODOS LOS INPUTS EN LA PÁGINA...\n');

    const allInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      return Array.from(inputs).map((input, index) => ({
        index,
        type: input.type,
        id: input.id || 'sin-id',
        name: input.name || 'sin-name',
        value: input.value,
        placeholder: input.placeholder || 'sin-placeholder',
        className: input.className || 'sin-class'
      }));
    });

    logger.info('📋 TODOS los inputs encontrados:');
    allInputs.forEach(input => {
      logger.info(`  [${input.index}] Type: "${input.type}", ID: "${input.id}", Name: "${input.name}", Class: "${input.className}", Value: "${input.value}"`);
    });

    // Filtrar inputs que probablemente sean de fecha
    const dateInputs = allInputs.filter(input =>
      input.id.toLowerCase().includes('fecha') ||
      input.name.toLowerCase().includes('fecha') ||
      input.id.toLowerCase().includes('date') ||
      input.name.toLowerCase().includes('date')
    );

    logger.info('\n📅 Inputs que parecen ser de FECHA:');
    dateInputs.forEach(input => {
      logger.info(`  [${input.index}] Type: "${input.type}", ID: "${input.id}", Name: "${input.name}", Value: "${input.value}"`);
    });

    // 4. Configurar fechas usando los inputs específicos (id="desde" y id="hasta")
    logger.info('\n📝 Configurando fechas usando inputs con id="desde" y id="hasta"...');
    logger.info(`   Fecha a configurar: ${yesterdayDate}`);

    // Método 1: Intentar con los primeros 2 inputs de texto (como hace el script actual)
    const textInputs = await page.$$('input[type="text"]');
    logger.info(`   Total inputs de texto encontrados: ${textInputs.length}`);

    if (textInputs.length >= 2) {
      const dateFromInput = textInputs[0];
      const dateToInput = textInputs[1];

      // Configurar fecha "desde"
      await dateFromInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);
      await dateFromInput.type(yesterdayDate, { delay: 100 });
      logger.info(`   ✓ Fecha "desde" configurada vía typing`);

      // Configurar fecha "hasta"
      await dateToInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300);
      await dateToInput.type(yesterdayDate, { delay: 100 });
      logger.info(`   ✓ Fecha "hasta" configurada vía typing`);

      // Cerrar datepicker
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.click('body');
      await page.waitForTimeout(1000);
    }

    // Método 2: Forzar valores directamente con evaluate (para inputs readonly)
    logger.info('\n📝 Forzando valores directamente (para inputs readonly)...');

    // Esperar explícitamente a que los inputs estén presentes en el DOM
    await page.waitForSelector('#desde', { timeout: 10000 });
    await page.waitForSelector('#hasta', { timeout: 10000 });
    logger.info('   ✓ Inputs #desde y #hasta encontrados en DOM');

    await page.evaluate((dateValue) => {
      const desdeInput = document.getElementById('desde');
      const hastaInput = document.getElementById('hasta');

      if (desdeInput) {
        desdeInput.value = dateValue;
        desdeInput.dispatchEvent(new Event('change', { bubbles: true }));
        desdeInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`✓ Input "desde" forzado a: ${dateValue}`);
      }

      if (hastaInput) {
        hastaInput.value = dateValue;
        hastaInput.dispatchEvent(new Event('change', { bubbles: true }));
        hastaInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log(`✓ Input "hasta" forzado a: ${dateValue}`);
      }
    }, yesterdayDate);

    await page.waitForTimeout(1000);

    // 5. Verificar valores DESPUÉS de configurarlos
    logger.info('\n✅ Fechas configuradas. Verificando valores...\n');

    const afterValues = await page.evaluate(() => {
      const desdeInput = document.getElementById('desde');
      const hastaInput = document.getElementById('hasta');

      return {
        desde: {
          id: desdeInput?.id || 'no-encontrado',
          name: desdeInput?.name || 'no-encontrado',
          value: desdeInput?.value || 'no-encontrado',
          readonly: desdeInput?.readOnly || false
        },
        hasta: {
          id: hastaInput?.id || 'no-encontrado',
          name: hastaInput?.name || 'no-encontrado',
          value: hastaInput?.value || 'no-encontrado',
          readonly: hastaInput?.readOnly || false
        }
      };
    });

    logger.info('📋 Valores de los inputs de fecha por ID:');
    logger.info(`  Input "desde" (id="${afterValues.desde.id}", name="${afterValues.desde.name}"): "${afterValues.desde.value}" ${afterValues.desde.readonly ? '[readonly]' : ''}`);
    logger.info(`  Input "hasta" (id="${afterValues.hasta.id}", name="${afterValues.hasta.name}"): "${afterValues.hasta.value}" ${afterValues.hasta.readonly ? '[readonly]' : ''}`);

    // 6. Validar que las fechas se configuraron correctamente
    logger.info('\n🔍 VALIDACIÓN:\n');

    const desdeCorrect = afterValues.desde.value === yesterdayDate;
    const hastaCorrect = afterValues.hasta.value === yesterdayDate;

    logger.info(`${desdeCorrect ? '✅' : '❌'} Input DESDE: "${afterValues.desde.value}" ${desdeCorrect ? '== "' + yesterdayDate + '" ✓' : '!= "' + yesterdayDate + '" ✗'}`);
    logger.info(`${hastaCorrect ? '✅' : '❌'} Input HASTA: "${afterValues.hasta.value}" ${hastaCorrect ? '== "' + yesterdayDate + '" ✓' : '!= "' + yesterdayDate + '" ✗'}`);

    logger.info('');
    if (desdeCorrect && hastaCorrect) {
      logger.info('✅✅✅ PRUEBA EXITOSA: Las fechas se configuraron correctamente ✅✅✅');
    } else {
      logger.error('❌ PRUEBA FALLIDA: Las fechas no se configuraron correctamente');
      logger.info('\n💡 NOTA: Los inputs tienen atributo readonly, puede que el método .type() no funcione.');
      logger.info('   El script de producción debería usar page.evaluate() para cambiar el valor directamente.');
    }

    // 7. Screenshot de evidencia
    await page.screenshot({ 
      path: 'logs/test-date-filter.png', 
      fullPage: false 
    });
    logger.info('\n📸 Screenshot guardado en: logs/test-date-filter.png');

    logger.info('\n✅ Prueba completada. El navegador permanecerá abierto para inspección manual.');
    logger.info('   Presiona Ctrl+C para cerrar.\n');

    // Mantener el navegador abierto
    await new Promise(() => {});

  } catch (error) {
    logger.error('❌ Error en la prueba:', error);
    await page.screenshot({ path: 'logs/test-date-filter-error.png' });
    logger.info('📸 Screenshot de error guardado en: logs/test-date-filter-error.png');
    throw error;
  }
}

// Ejecutar
testDateFilter()
  .then(() => logger.info('Script finalizado'))
  .catch((error) => {
    logger.error('Error fatal:', error);
    process.exit(1);
  });
