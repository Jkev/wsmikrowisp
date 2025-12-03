import puppeteer from 'puppeteer';
import { config } from './config/credentials.js';
import fs from 'fs';

async function exploreSite() {
  console.log('🔍 Exploración simplificada...\n');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  try {
    const page = await browser.newPage();

    // LOGIN
    console.log('1️⃣ Login...');
    await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.type('input[name="mail"]', config.username);
    await page.type('input[name="password"]', config.password);

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.find(btn => btn.textContent?.includes('Ingresar'))?.click();
    });

    console.log('2️⃣ Esperando dashboard (15 segundos)...');
    await page.waitForTimeout(15000);

    console.log('3️⃣ Tomando screenshot...');
    await page.screenshot({ path: 'logs/dashboard-full.png', fullPage: false });

    console.log('4️⃣ Analizando DOM...');
    const analysis = await page.evaluate(() => {
      const result = {
        allText: [],
        clickables: []
      };

      // Obtener TODOS los elementos con texto
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null
      );

      const seen = new Set();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.textContent?.trim();

        if (text && text.length > 0 && text.length < 100 && !seen.has(text)) {
          seen.add(text);

          // Si es clickeable
          if (node.tagName === 'A' || node.tagName === 'BUTTON' ||
              node.onclick || node.getAttribute('role') === 'button' ||
              node.style.cursor === 'pointer') {
            result.clickables.push({
              tag: node.tagName,
              text: text.substring(0, 80),
              class: node.className?.substring(0, 50) || '',
              id: node.id || ''
            });
          }
        }
      }

      return result;
    });

    console.log('\n📋 Elementos clickeables encontrados:', analysis.clickables.length);
    analysis.clickables.forEach((el, i) => {
      console.log(`${i + 1}. [${el.tag}] "${el.text}" (class: ${el.class}, id: ${el.id})`);
    });

    // Guardar análisis completo
    fs.writeFileSync('logs/analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\n💾 Análisis completo guardado en logs/analysis.json');

    // Intentar encontrar y hacer click en Finanzas de manera más flexible
    console.log('\n5️⃣ Intentando click en elemento que contenga "Finanzas"...');
    const finanzasClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text.includes('Finanzas') && text.length < 50) {
          console.log('Encontrado:', el.tagName, text);
          el.click();
          return { success: true, text, tag: el.tagName };
        }
      }
      return { success: false };
    });

    console.log('Resultado:', finanzasClicked);

    if (finanzasClicked.success) {
      console.log('✅ Click en Finanzas ejecutado');
      await page.waitForTimeout(3000);

      // Intentar click en Facturas
      console.log('\n6️⃣ Intentando click en elemento que contenga "Facturas"...');
      const facturasClicked = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          if (text === 'Facturas' || (text.includes('Facturas') && text.length < 50)) {
            console.log('Encontrado:', el.tagName, text);
            el.click();
            return { success: true, text, tag: el.tagName };
          }
        }
        return { success: false };
      });

      console.log('Resultado:', facturasClicked);

      if (facturasClicked.success) {
        console.log('✅ Click en Facturas ejecutado');
        console.log('\n7️⃣ Esperando que cargue la vista (20 segundos)...');
        await page.waitForTimeout(20000);

        await page.screenshot({ path: 'logs/facturas-view.png', fullPage: false });
        console.log('✅ Screenshot guardado');

        // Analizar la vista de facturas
        const facturasInfo = await page.evaluate(() => {
          return {
            inputs: Array.from(document.querySelectorAll('input')).map(inp => ({
              type: inp.type,
              name: inp.name || 'N/A',
              placeholder: inp.placeholder || 'N/A',
              id: inp.id || 'N/A'
            })),
            buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
              text: btn.textContent?.trim().substring(0, 50) || 'N/A'
            })),
            tables: document.querySelectorAll('table').length,
            url: window.location.href
          };
        });

        console.log('\n📊 Vista de Facturas:');
        console.log('URL:', facturasInfo.url);
        console.log('Inputs:', facturasInfo.inputs.length);
        facturasInfo.inputs.forEach((inp, i) => console.log(`  ${i+1}.`, inp));
        console.log('\nBotones:', facturasInfo.buttons.length);
        facturasInfo.buttons.forEach((btn, i) => console.log(`  ${i+1}.`, btn.text));
        console.log('\nTablas:', facturasInfo.tables);
      }
    }

    console.log('\n⏸️  Navegador abierto por 90 segundos para inspección...');
    await page.waitForTimeout(90000);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

exploreSite();
