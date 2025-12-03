# MikroWISP Scraper - Descarga Automática de PDFs de Facturas

Sistema automatizado para descargar PDFs de recibos de pago de clientes en MikroWISP.

## Características

- ✅ Login automático en MikroWISP
- ✅ Filtrado de facturas por fecha (día anterior por defecto)
- ✅ Descarga masiva de PDFs
- ✅ Manejo de reintentos automáticos
- ✅ Nomenclatura organizada: `YYYY-MM-DD_{idCliente}_{nombreCliente}_{numFactura}.pdf`
- ✅ Logs detallados de cada ejecución
- ✅ Reporte JSON de descargas exitosas y fallidas
- ✅ Soporte para ejecución programada (cron)

## Requisitos

- Node.js 18+
- npm o yarn
- Sistema operativo: Windows, Linux o macOS

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar credenciales
# Editar src/config/credentials.js con tus credenciales
```

## Configuración

### 1. Credenciales

Edita `src/config/credentials.js`:

```javascript
export const config = {
  loginUrl: 'https://portal.digy.mx/admin/login',
  username: 'tu-usuario',
  password: 'tu-contraseña',
  // ...
};
```

### 2. Selectores (IMPORTANTE)

**Antes de usar en producción**, debes actualizar los selectores en `src/config/selectors.js` según la estructura real del sitio.

Para obtener los selectores correctos:

```bash
# Ejecutar script de exploración manual
npm run manual-helper

# Esto abrirá el navegador con DevTools
# Navega a Finanzas → Facturas
# En la consola del navegador ejecuta: await window.captureInfo()
# Usa los resultados para actualizar src/config/selectors.js
```

## Uso

### Modo Manual (Para pruebas)

```bash
# Ejecutar con navegador visible (modo test)
npm run test

# Ejecutar con navegador visible para una fecha específica
npm start -- --no-headless --date=2024-12-01
```

### Modo Automático (Producción)

```bash
# Ejecutar en modo headless (sin interfaz gráfica)
npm start

# Descargar PDFs de una fecha específica
npm start -- --date=2024-12-01
```

### Opciones de línea de comandos

- `--test`: Modo test (navegador visible)
- `--no-headless`: Mostrar navegador (útil para debugging)
- `--date=YYYY-MM-DD`: Fecha específica a procesar (por defecto: día anterior)

## Estructura de Archivos

```
wsmikrowisp/
├── src/
│   ├── config/
│   │   ├── credentials.js      # Credenciales (NO commit)
│   │   └── selectors.js        # Selectores CSS configurables
│   ├── services/
│   │   ├── auth.service.js     # Servicio de autenticación
│   │   ├── navigation.service.js # Servicio de navegación
│   │   ├── scraper.service.js  # Servicio de scraping
│   │   └── download.service.js # Servicio de descarga PDFs
│   ├── utils/
│   │   ├── logger.js           # Sistema de logging
│   │   └── helpers.js          # Funciones auxiliares
│   ├── index.js                # Script principal
│   ├── manual-helper.js        # Helper para exploración manual
│   └── explore*.js             # Scripts de exploración
├── downloads/                   # PDFs descargados (por fecha)
│   └── 2024-12-03/
│       ├── 2024-12-02_1234_JuanPerez_INV001.pdf
│       ├── 2024-12-02_5678_MariaGomez_INV002.pdf
│       └── download-report.json
├── logs/                        # Logs de ejecución
│   ├── scraper.log
│   ├── errors.log
│   └── run-2024-12-03.log
├── package.json
└── README.md
```

## Programación Automática (Cron)

### Linux / macOS

Edita el crontab:

```bash
crontab -e
```

Agrega la siguiente línea para ejecutar diariamente a las 2 AM:

```cron
0 2 * * * cd /ruta/completa/wsmikrowisp && /usr/bin/node src/index.js >> logs/cron.log 2>&1
```

### Windows (Task Scheduler)

1. Abre "Programador de tareas" (Task Scheduler)
2. Crear tarea básica
3. Nombre: "MikroWISP PDF Downloader"
4. Desencadenador: Diariamente a las 2:00 AM
5. Acción: Iniciar programa
   - Programa: `node.exe` (ruta completa, ej: `C:\Program Files\nodejs\node.exe`)
   - Argumentos: `src\index.js`
   - Iniciar en: Ruta completa al proyecto

### Verificar ejecuciones programadas

```bash
# Ver el log del último cron
tail -f logs/cron.log

# Ver logs de ejecución
ls -la logs/run-*.log
```

## Monitoreo y Logs

Cada ejecución genera:

1. **Log general**: `logs/scraper.log` - Historial de todas las ejecuciones
2. **Log de ejecución**: `logs/run-YYYY-MM-DD.log` - Log específico de cada día
3. **Log de errores**: `logs/errors.log` - Solo errores
4. **Reporte JSON**: `downloads/YYYY-MM-DD/download-report.json` - Detalle de descargas

### Ejemplo de reporte JSON

```json
{
  "timestamp": "2024-12-03T02:00:00.000Z",
  "summary": {
    "total": 500,
    "successful": 498,
    "failed": 2
  },
  "successfulDownloads": [
    {
      "invoiceNumber": "INV-001",
      "clientName": "Juan Pérez",
      "clientId": "1234",
      "filename": "2024-12-02_1234_JuanPerez_INV-001.pdf"
    }
  ],
  "failedDownloads": [
    {
      "invoiceNumber": "INV-999",
      "clientName": "Cliente X",
      "clientId": "9999",
      "error": "Timeout esperando descarga"
    }
  ]
}
```

## Solución de Problemas

### Error: "Navegación timeout"

- Verifica tu conexión a internet
- Aumenta el `navigationTimeout` en `src/config/credentials.js`
- Ejecuta en modo `--no-headless` para ver qué está pasando

### Error: "Login falló"

- Verifica las credenciales en `src/config/credentials.js`
- Verifica que no haya CAPTCHA o 2FA activado

### No se encuentran facturas

- Verifica que los selectores en `src/config/selectors.js` sean correctos
- Ejecuta `npm run manual-helper` para explorar manualmente
- Revisa el log: `logs/run-*.log`

### PDFs no se descargan

- Verifica los selectores del botón de descarga en `src/config/selectors.js`
- Verifica permisos de escritura en la carpeta `downloads/`
- Revisa el `download-report.json` para ver errores específicos

## Scripts de Desarrollo

```bash
# Exploración manual con helpers
npm run manual-helper

# Modo exploración automática (obsoleto, usar manual-helper)
npm run explore
```

## Seguridad

- ⚠️  **NUNCA** commitees el archivo `src/config/credentials.js` a git
- El archivo `.gitignore` ya está configurado para ignorarlo
- Usa variables de entorno para producción si es necesario

## Mantenimiento

### Actualizar selectores

Si MikroWISP cambia su interfaz:

1. Ejecuta `npm run manual-helper`
2. Navega manualmente al sitio
3. Usa DevTools para identificar nuevos selectores
4. Actualiza `src/config/selectors.js`
5. Prueba con `npm run test`

## Soporte

Para reportar problemas o sugerencias, contacta al equipo de desarrollo.

## Licencia

MIT
