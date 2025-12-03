# Guía de Configuración - MikroWISP Scraper

Esta guía te ayudará a configurar el scraper paso a paso.

## Paso 1: Instalación Inicial

```bash
# 1. Clonar o descargar el proyecto
cd /ruta/a/wsmikrowisp

# 2. Instalar dependencias
npm install

# 3. Verificar instalación
node --version  # Debe ser v18+
npm --version
```

## Paso 2: Exploración del Sitio (IMPORTANTE)

Antes de usar el scraper en producción, debes identificar los selectores CSS correctos.

### 2.1 Ejecutar Helper Manual

```bash
npm run manual-helper
```

Esto abrirá el navegador y hará login automáticamente.

### 2.2 Navegar a Facturas

1. En el navegador abierto, navega manualmente a: **Finanzas → Facturas**
2. Abre DevTools (F12) y ve a la pestaña **Console**
3. Ejecuta: `await window.captureInfo()`
4. Copia el resultado (JSON)

### 2.3 Identificar Selectores

Con el resultado del paso anterior, identifica:

#### A. Filtros de Fecha

Busca en los inputs encontrados cuáles corresponden a filtros de fecha:

```javascript
// Ejemplo de resultado:
{
  inputs: [
    {
      type: "date",
      name: "fecha_inicio",    // <-- Este es el selector que necesitas
      id: "filter-date-from",
      placeholder: "Desde"
    },
    {
      type: "date",
      name: "fecha_fin",        // <-- Y este también
      id: "filter-date-to",
      placeholder: "Hasta"
    }
  ]
}
```

#### B. Botón de Filtrar

Busca en los botones cuál aplica el filtro:

```javascript
{
  buttons: [
    { text: "Filtrar" },      // <-- Este es el botón
    { text: "Limpiar" },
    ...
  ]
}
```

#### C. Estructura de la Tabla

Inspecciona manualmente la tabla para identificar:
- ¿En qué columna está el número de factura?
- ¿En qué columna está el ID del cliente?
- ¿En qué columna está el nombre del cliente?
- ¿Dónde está el botón/enlace para descargar el PDF?

## Paso 3: Actualizar Selectores

Edita `src/config/selectors.js` con los selectores correctos.

### Ejemplo de configuración:

```javascript
export const selectors = {
  facturas: {
    // Si hay UN solo input de fecha
    dateInput: 'input[name="fecha"]',

    // O si hay rango de fechas
    dateFromInput: 'input[name="fecha_inicio"]',
    dateToInput: 'input[name="fecha_fin"]',

    // Botón para aplicar filtros
    filterButton: 'button[id="btn-filtrar"]',

    // Tabla de resultados
    tableRows: 'table.facturas tbody tr',

    // Si los datos están en columnas específicas, actualiza el scraper
    // para usar los índices correctos
  }
};
```

## Paso 4: Actualizar Lógica de Extracción

Edita `src/services/scraper.service.js` en el método `extractInvoices()`.

Ajusta los índices de las columnas según la estructura real:

```javascript
// Ejemplo: Si la tabla tiene este orden de columnas:
// [Fecha] [Cliente] [ID] [Monto] [Estado] [Acciones]

const invoice = {
  date: cells[0]?.textContent?.trim() || 'N/A',           // Columna 0
  clientName: cells[1]?.textContent?.trim() || 'N/A',     // Columna 1
  clientId: cells[2]?.textContent?.trim() || 'N/A',       // Columna 2
  amount: cells[3]?.textContent?.trim() || '0',           // Columna 3
  status: cells[4]?.textContent?.trim() || 'N/A',         // Columna 4
  invoiceNumber: cells[0]?.textContent?.trim() || `INV-${index}`, // Ajustar según necesidad
};
```

## Paso 5: Actualizar Lógica de Descarga de PDFs

Edita `src/services/download.service.js` en el método `downloadInvoicePDF()`.

Ajusta el selector del botón/enlace de descarga:

```javascript
// Si el PDF está en un botón con clase específica:
const pdfElement = row.querySelector('button.btn-download-pdf');

// Si está en un enlace:
const pdfElement = row.querySelector('a[href*="download"]');

// Si está en un ícono específico:
const pdfElement = row.querySelector('i.fa-file-pdf').closest('button');
```

## Paso 6: Pruebas

### 6.1 Prueba Manual con Navegador Visible

```bash
npm run test
```

Observa el navegador:
- ¿Hace login correctamente?
- ¿Navega a Facturas?
- ¿Aplica el filtro de fecha?
- ¿Encuentra las facturas?
- ¿Descarga los PDFs?

### 6.2 Revisar Logs

```bash
# Ver el último log de ejecución
tail -f logs/run-*.log

# Ver errores
cat logs/errors.log
```

### 6.3 Verificar Descargas

```bash
# Ver archivos descargados
ls -la downloads/2024-12-*/

# Ver reporte
cat downloads/2024-12-*/download-report.json
```

## Paso 7: Configuración para Producción

### 7.1 Configurar Credenciales

Edita `src/config/credentials.js`:

```javascript
export const config = {
  loginUrl: 'https://portal.digy.mx/admin/login',
  username: 'tu-usuario-real',
  password: 'tu-contraseña-real',

  // Ajustar timeouts si es necesario
  navigationTimeout: 60000,
  waitTimeout: 5000,

  // Ajustar reintentos
  maxRetries: 3,
  retryDelay: 2000,
};
```

### 7.2 Probar en Modo Headless

```bash
npm start
```

Verifica que funcione sin mostrar el navegador.

## Paso 8: Programar Ejecución Automática

### En Linux/macOS:

```bash
chmod +x cron-setup.sh
./cron-setup.sh
```

### En Windows:

1. Abre "Programador de tareas"
2. "Crear tarea básica"
3. Nombre: MikroWISP PDF Downloader
4. Desencadenador: Diariamente a las 2:00 AM
5. Acción: Iniciar programa
   - Programa: `C:\Program Files\nodejs\node.exe`
   - Argumentos: `src\index.js`
   - Iniciar en: `C:\ruta\completa\wsmikrowisp`

## Paso 9: Monitoreo

### Ver si el cron está funcionando:

```bash
# Linux/macOS
crontab -l
tail -f logs/cron.log

# Windows
# Abrir "Visor de eventos" → Biblioteca de programador de tareas
```

### Verificar ejecuciones diarias:

```bash
# Ver logs por fecha
ls -la logs/run-*.log

# Ver último log
tail -100 logs/run-$(date +%Y-%m-%d).log
```

## Troubleshooting

### Problema: "No se encuentran facturas"

**Solución**:
1. Ejecuta `npm run test`
2. Observa el navegador en la página de facturas
3. Verifica que el filtro de fecha se aplique correctamente
4. Revisa `src/config/selectors.js` → `dateFromInput`, `dateToInput`

### Problema: "PDFs no se descargan"

**Solución**:
1. Ejecuta `npm run test`
2. Observa si hace click en el botón correcto
3. Usa DevTools para identificar el selector del botón de PDF
4. Actualiza `src/services/download.service.js` → método `downloadInvoicePDF()`

### Problema: "Login falla"

**Solución**:
1. Verifica credenciales en `src/config/credentials.js`
2. Verifica que no haya CAPTCHA
3. Intenta hacer login manual para verificar

### Problema: "Timeout en navegación"

**Solución**:
1. Aumenta `navigationTimeout` en `src/config/credentials.js`
2. Verifica tu conexión a internet
3. Verifica que el sitio esté disponible

## Próximos Pasos

Una vez configurado:

1. ✅ Deja que corra automáticamente a las 2 AM
2. 📊 Revisa los reportes diariamente
3. 📝 Monitorea los logs para detectar problemas
4. 🔧 Ajusta selectores si MikroWISP cambia su interfaz

## Soporte

Si encuentras problemas, revisa:
- Los logs en `logs/`
- Los screenshots en `logs/*.png`
- El reporte JSON en `downloads/*/download-report.json`
