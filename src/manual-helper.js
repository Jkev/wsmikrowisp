import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';

/**
 * Script interactivo para exploración manual
 * - Abre el navegador y hace login
 * - Te deja navegar manualmente
 * - Expone funciones en la consola del navegador para capturar información
 */

async function manualExploration() {
  console.log('🔧 Modo de exploración manual\n');
  console.log('Este script:');
  console.log('1. Abrirá el navegador');
  console.log('2. Hará login automáticamente');
  console.log('3. Te permitirá navegar manualmente');
  console.log('4. Guardará información útil\n');
  console.log('El navegador permanecerá abierto hasta que presiones Ctrl+C\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    devtools: true, // Abrir DevTools
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();

    // Exponer funciones útiles en la página
    await page.exposeFunction('captureInfo', async () => {
      const info = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          inputs: Array.from(document.querySelectorAll('input')).map(inp => ({
            type: inp.type,
            name: inp.name || 'N/A',
            id: inp.id || 'N/A',
            placeholder: inp.placeholder || 'N/A',
            value: inp.value || ''
          })),
          buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
            text: btn.textContent?.trim().substring(0, 100) || 'N/A',
            id: btn.id || 'N/A',
            class: btn.className || 'N/A'
          })),
          tables: Array.from(document.querySelectorAll('table')).map((table, i) => ({
            index: i,
            rows: table.querySelectorAll('tr').length,
            headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim())
          }))
        };
      });
      console.log('\n📊 Información capturada:');
      console.log(JSON.stringify(info, null, 2));
      return info;
    });

    // LOGIN AUTOMÁTICO
    console.log('🔐 Haciendo login...');
    try {
      await page.goto(config.loginUrl, { waitUntil: 'dom contentloaded', timeout: 90000 });
      await page.waitForTimeout(3000);

      await page.waitForSelector('input[name="mail"]', { timeout: 10000 });
      await page.type('input[name="mail"]', config.username);
      await page.type('input[name="password"]', config.password);

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        buttons.find(btn => btn.textContent?.includes('Ingresar'))?.click();
      });

      await page.waitForTimeout(8000);
      console.log('✅ Login exitoso!');
      console.log('📍 URL:', page.url());
    } catch (error) {
      console.log('⚠️  Error en login automático:', error.message);
      console.log('Por favor, haz login manualmente en el navegador');
    }

    // Instrucciones
    console.log('\n' + '='.repeat(60));
    console.log('INSTRUCCIONES PARA EXPLORACIÓN MANUAL:');
    console.log('='.repeat(60));
    console.log('\n1. Navega a: Finanzas → Facturas');
    console.log('2. Abre la consola del navegador (F12 → Console)');
    console.log('3. Escribe: await window.captureInfo()');
    console.log('4. Copia el resultado y compártelo');
    console.log('\n5. Prueba filtrar por fecha y descargar un PDF');
    console.log('6. Observa las URLs y selectores que se usan\n');
    console.log('El navegador permanecerá abierto.');
    console.log('Presiona Ctrl+C en esta terminal cuando termines.\n');
    console.log('='.repeat(60) + '\n');

    // Mantener el proceso vivo
    await new Promise(() => {}); // Espera infinita

  } catch (error) {
    if (error.message !== 'Target closed') {
      console.error('❌ Error:', error.message);
    }
  } finally {
    console.log('\n👋 Cerrando...');
    await browser.close();
  }
}

// Manejar Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n🛑 Exploración manual finalizada');
  process.exit(0);
});

manualExploration();
