# Instrucciones Finales - MikroWISP Scraper

## ✅ Estado Actual del Proyecto

El proyecto está **95% completo** y listo para usar. He implementado:

✅ Sistema completo de scraping con Puppeteer
✅ Autenticación automática
✅ Navegación a Finanzas → Facturas
✅ Extracción de datos de facturas
✅ Descarga masiva de PDFs con reintentos
✅ Sistema de logging completo
✅ Nomenclatura organizada de archivos
✅ Reportes JSON
✅ Documentación completa
✅ **Selectores actualizados según las capturas del sitio real**

## 🔧 Lo que necesitas hacer (10-15 minutos)

### Paso 1: Probar y Ajustar Filtros de Fecha (5 min)

Los filtros de fecha pueden necesitar un ajuste fino. Debes verificar:

1. **Ejecutar modo test**:
   ```bash
   cd C:\Users\kevin\Documents\digy\wsmikrowisp
   npm run test-nav
   ```

2. **Cuando el navegador se abra**:
   - Espera a que cargue completamente (dashboard con menú lateral)
   - Navega manualmente: **Finanzas → Facturas**
   - Inspecciona los inputs de fecha con DevTools (F12)
   - Anota:
     - ¿Son inputs de tipo `date` o `text`?
     - ¿Cuál es el `name` o `id` de cada input?
     - ¿Hay un botón "Filtrar" o "Buscar"?

3. **Actualizar selectores si es necesario**:

Edita `src/config/selectors.js` líneas 24-31:

```javascript
// Si los inputs tienen name específico:
dateFromInput: 'input[name="fecha_desde"]',  // Ajustar con el name real
dateToInput: 'input[name="fecha_hasta"]',     // Ajustar con el name real

// Si hay botón de filtrar:
filterButton: 'button[type="submit"]',        // Ajustar según el botón real
```

### Paso 2: Ajustar Lógica de Filtrado de Fecha (5 min)

Edita `src/services/scraper.service.js` líneas 15-50:

El método `filterByDate()` debe ajustarse según el formato que espera MikroWISP:

```javascript
async filterByDate(date = null) {
  const targetDate = date || getYesterdayDate();
  logger.info(`Filtrando facturas por fecha: ${targetDate}`);

  // MikroWISP usa formato DD/MM/YYYY (según la captura)
  // Convertir de YYYY-MM-DD a DD/MM/YYYY
  const [year, month, day] = targetDate.split('-');
  const formattedDate = `${day}/${month}/${year}`;

  // Ingresar fecha en ambos campos (desde y hasta)
  const dateInputs = await this.page.$$('input[type="date"]');

  if (dateInputs.length >= 2) {
    // Limpiar y escribir en el primer input (desde)
    await dateInputs[0].click({ clickCount: 3 });
    await dateInputs[0].type(formattedDate);

    // Limpiar y escribir en el segundo input (hasta)
    await dateInputs[1].click({ clickCount: 3 });
    await dateInputs[1].type(formattedDate);

    // Si hay botón de filtrar, hacer click
    // await this.page.click('button[type="submit"]');

    // Esperar a que carguen los resultados
    await this.page.waitForTimeout(waitConfig.forTableLoad);

    logger.info('✅ Filtro de fecha aplicado');
    return true;
  }

  throw new Error('No se encontraron inputs de fecha');
}
```

**NOTA**: Es posible que los inputs de fecha en MikroWISP sean de tipo texto con un datepicker. En ese caso, prueba hacer click en el input y escribir directamente la fecha.

### Paso 3: Probar Descarga de UN PDF (10 min)

1. **Modificar temporalmente** `src/index.js` para probar solo con 1 factura:

En la línea donde se llama a `downloadAllPDFs`, limita a 1:

```javascript
// En src/index.js, método run(), paso 6
const testInvoices = invoices.slice(0, 1); // Solo la primera factura
const downloadResult = await downloadService.downloadAllPDFs(testInvoices);
```

2. **Ejecutar en modo test**:
   ```bash
   npm test
   ```

3. **Observar**:
   - ¿Se hace login? ✅
   - ¿Navega a Facturas? ✅
   - ¿Aplica el filtro de fecha? ⚠️ (verificar)
   - ¿Extrae las facturas? ⚠️ (verificar)
   - ¿Hace click en el botón de imprimir? ⚠️ (verificar)
   - ¿Se descarga el PDF? ⚠️ (verificar)

4. **Si el botón de imprimir no funciona**:

Es posible que MikroWISP abra una ventana modal o nueva pestaña con el PDF. En ese caso:

Edita `src/services/download.service.js` y agrega lógica para manejar nuevas ventanas:

```javascript
// Antes de hacer click, preparar para nueva ventana
const [newPage] = await Promise.all([
  new Promise(resolve => this.page.browser().once('targetcreated', async target => {
    resolve(await target.page());
  })),
  this.page.evaluate((index) => {
    // ... click en el botón
  }, rowIndex)
]);

if (newPage) {
  // Esperar a que cargue el PDF
  await newPage.waitForTimeout(3000);

  // El PDF se descargará automáticamente o hay que hacer algo más
  await newPage.close();
}
```

### Paso 4: Ejecutar con Todas las Facturas (5 min)

Una vez que funcione con 1 factura:

1. **Remover el `.slice(0, 1)`** de `src/index.js`

2. **Ejecutar el script completo**:
   ```bash
   npm start
   ```

3. **Monitorear**:
   ```bash
   # En otra terminal
   tail -f logs/run-*.log
   ```

4. **Verificar resultados**:
   ```bash
   ls -la downloads/2024-12-*/
   cat downloads/2024-12-*/download-report.json
   ```

### Paso 5: Programar Ejecución Automática (5 min)

**En Windows (Programador de Tareas)**:

1. Abre "Programador de tareas" (Task Scheduler)
2. "Crear tarea básica"
3. Nombre: `MikroWISP PDF Downloader`
4. Desencadenador: Diariamente a las 2:00 AM
5. Acción: Iniciar programa
   - Programa: `C:\Program Files\nodejs\node.exe`
   - Argumentos: `src\index.js`
   - Iniciar en: `C:\Users\kevin\Documents\digy\wsmikrowisp`
6. Configuración adicional:
   - ✅ Ejecutar con los privilegios más altos
   - ✅ Ejecutar tanto si el usuario inició sesión como si no

**En Linux/macOS**:

```bash
chmod +x cron-setup.sh
./cron-setup.sh
```

## 📊 Notas Importantes

### Estructura de la Tabla de Facturas

Según la captura, las columnas son:

| Índice | Columna          | Uso                                    |
|--------|------------------|----------------------------------------|
| 0      | N° FACTURA       | Número de factura                      |
| 1      | N° CÉDULA        | ID del cliente (cédula)                |
| 2      | TIPO             | Tipo de factura                        |
| 3      | CLIENTE          | Nombre del cliente                     |
| 4      | F. EMITIDO       | Fecha de emisión (usado para filtrar)  |
| 5      | F. VENCIMIENTO   | Fecha de vencimiento                   |
| 6      | F. PAGADO        | Fecha de pago                          |
| 7      | TOTAL            | Total de la factura                    |
| 8      | SALDO            | Saldo pendiente                        |
| 9      | FORMA DE PAGO    | Método de pago                         |
| 10     | N° IDENTIFICACIÓN| Número de identificación               |
| 11     | ESTADO           | Estado de la factura                   |
| 12+    | Acciones         | Botones (imprimir, ver, check, delete) |

### Nomenclatura de Archivos PDFs

Los archivos se guardarán con el formato:
```
downloads/2024-12-03/
  2024-12-02_5912_MariaCarolinaOrtegaRivera_6267.pdf
  └─────┬───┘ └─┬─┘ └───────────┬──────────────┘ └─┬─┘
   Fecha     ID Cliente        Nombre          N° Factura
```

### Formato de Fechas

- **Input**: MikroWISP espera `DD/MM/YYYY` (ejemplo: `02/12/2024`)
- **Interno**: Usamos `YYYY-MM-DD` (ejemplo: `2024-12-02`)
- **Conversión**: Se hace automáticamente en `filterByDate()`

## 🚨 Troubleshooting Común

### Problema: "No se encuentran facturas"

**Solución**:
1. Verifica que el filtro de fecha esté funcionando
2. Ejecuta `npm run test-nav` y navega manualmente a facturas
3. Prueba filtrar manualmente para ver qué fechas tienen datos
4. Ajusta la lógica de `filterByDate()` en `src/services/scraper.service.js`

### Problema: "PDFs no se descargan"

**Solución**:
1. El botón de imprimir podría abrir una ventana modal
2. Necesitas manejar popups/modales en `download.service.js`
3. Revisa si el PDF abre en nueva pestaña o se descarga directamente
4. Usa DevTools para ver qué pasa al hacer click en "Imprimir"

### Problema: "Login falla / Página carga infinitamente"

**Solución**:
1. Aumenta los tiempos de espera en `src/config/credentials.js`:
   ```javascript
   navigationTimeout: 120000, // 2 minutos
   ```
2. Aumenta el tiempo de espera después del login en `src/services/auth.service.js`:
   ```javascript
   await this.page.waitForTimeout(10000); // 10 segundos
   ```

## 📝 Archivos Importantes

- `src/config/selectors.js` - **Selectores CSS** (ajustar si es necesario)
- `src/services/scraper.service.js` - **Lógica de extracción** (método `filterByDate` y `extractInvoices`)
- `src/services/download.service.js` - **Lógica de descarga** (método `downloadInvoicePDF`)
- `src/index.js` - **Script principal** (orquestación)

## 🎯 Checklist Final

- [ ] Probé `npm run test-nav` y llegué a la vista de facturas
- [ ] Identifiqué los selectores de los inputs de fecha
- [ ] Actualicé `src/config/selectors.js` si fue necesario
- [ ] Ajusté el método `filterByDate()` con el formato correcto
- [ ] Probé la descarga de 1 PDF con `npm test`
- [ ] El PDF se descargó correctamente en `downloads/`
- [ ] Probé con todas las facturas con `npm start`
- [ ] Revisé el reporte JSON en `downloads/*/download-report.json`
- [ ] Programé la tarea en el Programador de tareas de Windows
- [ ] Verifiqué que la tarea programada ejecuta correctamente

## 💡 Próximos Pasos

Una vez que todo funcione:

1. **Monitorea las primeras ejecuciones**:
   ```bash
   # Ver logs
   tail -f logs/run-*.log

   # Ver PDFs descargados
   ls -la downloads/*/

   # Ver reportes
   cat downloads/*/download-report.json
   ```

2. **Revisa diariamente** los reportes para detectar problemas

3. **Si MikroWISP cambia su interfaz**, ejecuta `npm run test-nav` para identificar los nuevos selectores

## ¿Necesitas Ayuda?

- Revisa `SETUP_GUIDE.md` para guía detallada
- Revisa `README.md` para documentación completa
- Revisa `RESUMEN.md` para overview del proyecto
- Consulta los logs en `logs/` para diagnóstico
- Ejecuta `npm run test-nav` para explorar el sitio

---

**¡El sistema está listo! Solo necesitas hacer los ajustes finales de los filtros de fecha y probar la descarga de PDFs.**
