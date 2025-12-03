# Quick Start - MikroWISP Scraper

## 🚀 Inicio Rápido (5 minutos)

### 1. Instalación

```bash
cd C:\Users\kevin\Documents\digy\wsmikrowisp
npm install
```

### 2. Verificar Credenciales

El archivo `src/config/credentials.js` ya tiene las credenciales configuradas:
- Usuario: `claude`
- Password: `~,Wy*fIO7`J$M:W`

### 3. Probar

```bash
# Ejecutar en modo test (navegador visible)
npm test
```

## 📋 Cómo Funciona

El scraper automáticamente:

1. ✅ Hace login en `https://portal.digy.mx/admin/login`
2. ✅ Navega a **Finanzas → Facturas**
3. ✅ Selecciona dropdown **Estado: Pagadas**
4. ✅ Filtra por **F. PAGADO** = día anterior (ayer)
5. ✅ Extrae todas las facturas que coinciden
6. ✅ Descarga el PDF de cada factura haciendo click en el botón de imprimir
7. ✅ Guarda los PDFs en `downloads/YYYY-MM-DD/`
8. ✅ Genera un reporte JSON con el resultado

## 📁 Estructura de Archivos Descargados

```
downloads/
└── 2024-12-03/                          # Carpeta por fecha de ejecución
    ├── 02-12-2024_5912_Maria_6267.pdf   # Formato: fecha_id_nombre_factura.pdf
    ├── 02-12-2024_3456_Juan_6268.pdf
    ├── ...
    └── download-report.json              # Reporte de la ejecución
```

**Nomenclatura del PDF**:
- `02-12-2024`: Fecha de pago (F. PAGADO)
- `5912`: ID del cliente (N° CÉDULA)
- `Maria`: Nombre del cliente (CLIENTE)
- `6267`: Número de factura (N° FACTURA)

## 🎯 Comandos Principales

```bash
# Ejecutar normalmente (headless, sin ver navegador)
npm start

# Ejecutar en modo test (navegador visible para debugging)
npm test

# Ejecutar con fecha específica
npm start -- --date=2024-12-01

# Probar navegación y ver análisis del sitio
npm run test-nav
```

## ✅ Verificar Resultados

Después de ejecutar:

```bash
# Ver PDFs descargados
ls downloads/2024-12-*/

# Ver reporte JSON
cat downloads/2024-12-*/download-report.json

# Ver logs
tail -50 logs/run-*.log
```

## 📊 Ejemplo de Reporte

```json
{
  "timestamp": "2024-12-03T02:00:00.000Z",
  "summary": {
    "total": 29,
    "successful": 29,
    "failed": 0
  },
  "successfulDownloads": [
    {
      "invoiceNumber": "6267",
      "clientName": "Maria Carolina Ortega Rivera",
      "clientId": "5912",
      "filename": "02-12-2024_5912_MariaCarolinaOrtegaRivera_6267.pdf"
    }
  ],
  "failedDownloads": []
}
```

## ⏰ Programar Ejecución Automática (Diaria a las 2 AM)

### Windows

1. Abre **Programador de tareas**
2. Crear tarea básica:
   - Nombre: `MikroWISP PDF Downloader`
   - Desencadenador: Diariamente a las 2:00 AM
   - Acción: Iniciar programa
     - Programa: `C:\Program Files\nodejs\node.exe`
     - Argumentos: `src\index.js`
     - Iniciar en: `C:\Users\kevin\Documents\digy\wsmikrowisp`

### Linux/macOS

```bash
chmod +x cron-setup.sh
./cron-setup.sh
```

## 🔧 Configuración Importante

### Filtros Aplicados

El scraper filtra facturas con:
- **Estado**: Pagadas
- **Fecha de pago (F. PAGADO)**: Día anterior

Esto significa que si hoy es `03/12/2024`, descargará los PDFs de todas las facturas que fueron **pagadas** el `02/12/2024`.

### Columnas de la Tabla

| Columna          | Uso                                      |
|------------------|------------------------------------------|
| N° FACTURA       | Identificador de la factura              |
| N° CÉDULA        | ID del cliente                           |
| CLIENTE          | Nombre del cliente                       |
| **F. PAGADO**    | **Fecha usada para filtrar** ⬅️         |
| TOTAL            | Monto total                              |
| ESTADO           | Se filtra solo "Pagadas"                 |

## 🚨 Troubleshooting

### Problema: No descarga PDFs

**Causa**: El botón de imprimir podría abrir un modal o nueva ventana.

**Solución**: Revisa `src/services/download.service.js` línea 76. Es posible que necesites agregar lógica para manejar popups.

### Problema: No encuentra facturas

**Causa**: El dropdown de "Estado" o el filtro de fecha no se aplicó correctamente.

**Solución**:
1. Ejecuta `npm test` (modo visible)
2. Observa si se selecciona "Pagadas" en el dropdown
3. Verifica que las fechas se ingresen correctamente
4. Revisa `src/services/scraper.service.js` línea 16 (método `filterByDate`)

### Problema: Fechas incorrectas

**Causa**: Formato de fecha incorrecto.

**Solución**: MikroWISP usa formato `DD/MM/YYYY`. El scraper convierte automáticamente de `YYYY-MM-DD` a `DD/MM/YYYY`. Verifica línea 65 de `scraper.service.js`.

## 📖 Documentación Completa

- **README.md**: Documentación general
- **SETUP_GUIDE.md**: Guía paso a paso de configuración
- **INSTRUCCIONES_FINALES.md**: Ajustes finales y troubleshooting
- **RESUMEN.md**: Overview del proyecto

## 🎉 ¡Listo!

El sistema está configurado y listo para usar. Solo ejecuta:

```bash
npm test
```

Y observa cómo funciona todo el flujo.

---

**¿Preguntas?** Revisa los archivos de documentación o ejecuta `npm run test-nav` para explorar el sitio.
