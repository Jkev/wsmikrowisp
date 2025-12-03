# Guía de Automatización - Descarga de Transacciones

## Descripción
Script automatizado para descargar facturas de transacciones del día anterior desde MikroWISP.

## Uso Manual

### Modo Visible (Debug)
Para ver el navegador mientras se ejecuta (útil para debugging):
```bash
npm run transacciones
```

### Modo Headless (Producción)
Para ejecutar sin interfaz gráfica (producción/automático):
```bash
HEADLESS=true npm run transacciones
```

### Con Logging Persistente
Para guardar logs con fecha:
```bash
npm run transacciones:log
```

## Automatización con Cron (Linux/Mac)

### Configurar Tarea Programada

1. Abrir el crontab:
```bash
crontab -e
```

2. Agregar una línea para ejecutar todos los días a las 3 AM:
```bash
0 3 * * * cd /ruta/al/proyecto/wsmikrowisp && HEADLESS=true /usr/bin/npm run transacciones >> /ruta/al/proyecto/wsmikrowisp/logs/cron.log 2>&1
```

### Ejemplos de Horarios Cron

```bash
# Todos los días a las 3:00 AM
0 3 * * * cd /path/to/wsmikrowisp && HEADLESS=true npm run transacciones

# Todos los días a las 2:30 AM
30 2 * * * cd /path/to/wsmikrowisp && HEADLESS=true npm run transacciones

# De lunes a viernes a las 6:00 AM
0 6 * * 1-5 cd /path/to/wsmikrowisp && HEADLESS=true npm run transacciones

# Cada hora (para testing)
0 * * * * cd /path/to/wsmikrowisp && HEADLESS=true npm run transacciones
```

## Automatización con Task Scheduler (Windows)

### Crear Tarea Programada

1. Abrir "Programador de tareas" (Task Scheduler)

2. Crear Tarea Básica:
   - Nombre: "MikroWISP Transacciones Diarias"
   - Descripción: "Descarga automática de transacciones del día anterior"

3. Desencadenador (Trigger):
   - Diariamente
   - Hora: 3:00 AM
   - Repetir cada: 1 día

4. Acción:
   - Programa/script: `C:\Program Files\nodejs\node.exe`
   - Argumentos: `C:\Users\kevin\Documents\digy\wsmikrowisp\src\download-transacciones.js`
   - Iniciar en: `C:\Users\kevin\Documents\digy\wsmikrowisp`

5. Configuración adicional:
   - Variables de entorno:
     - Nombre: `HEADLESS`
     - Valor: `true`

### Script PowerShell Alternativo

Crear archivo `run-transacciones.ps1`:
```powershell
cd C:\Users\kevin\Documents\digy\wsmikrowisp
$env:HEADLESS="true"
npm run transacciones
```

Luego programar este script en Task Scheduler.

### Script Batch Alternativo

Crear archivo `run-transacciones.bat`:
```batch
@echo off
cd C:\Users\kevin\Documents\digy\wsmikrowisp
set HEADLESS=true
npm run transacciones
```

## Estructura de Archivos Descargados

```
downloads/
└── transacciones/
    └── YYYY-MM-DD/                          # Fecha de ejecución
        ├── MX$350.00_5908_Cliente_Nombre_00005585.pdf
        ├── MX$350.00_5907_Cliente_Nombre_00006004.pdf
        ├── ...
        └── download-report.json             # Reporte JSON con resumen
```

## Logs

Los logs se guardan automáticamente en:
- `logs/last-run.log` - Última ejecución
- `logs/transacciones-YYYY-MM-DD.log` - Con fecha (si usas `:log`)
- `logs/transacciones-completado.png` - Screenshot final
- `logs/transacciones-error.png` - Screenshot en caso de error

## Monitoreo y Notificaciones

### Ver Logs en Tiempo Real
```bash
tail -f logs/last-run.log
```

### Verificar Última Ejecución
```bash
cat logs/last-run.log | grep "PROCESO COMPLETADO"
```

### Contar PDFs Descargados
```bash
ls downloads/transacciones/$(date +%Y-%m-%d)/*.pdf | wc -l
```

## Solución de Problemas

### El navegador no cierra automáticamente
- Asegúrate de ejecutar con `HEADLESS=true`
- Verifica que la variable de entorno esté configurada

### Error "Command not found: npm"
- Usa la ruta completa a npm: `/usr/bin/npm` o `C:\Program Files\nodejs\npm.cmd`

### PDFs no se descargan
- Verifica las credenciales en `src/config/credentials.js`
- Revisa el screenshot de error en `logs/transacciones-error.png`
- Ejecuta en modo visible para ver qué está pasando

### El filtro de fecha no funciona
- El script filtra por la columna "Fecha & Hora" directamente
- Solo descarga transacciones del día anterior (`getYesterdayDate()`)
- Verifica los logs para ver cuántas transacciones se encontraron

## Mantenimiento

### Limpiar Logs Antiguos (Linux/Mac)
```bash
find logs/ -name "*.log" -mtime +30 -delete
```

### Limpiar Logs Antiguos (Windows PowerShell)
```powershell
Get-ChildItem logs\*.log | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)} | Remove-Item
```

### Backup de PDFs
```bash
# Linux/Mac
tar -czf backup-$(date +%Y-%m-%d).tar.gz downloads/transacciones/

# Windows PowerShell
Compress-Archive -Path downloads\transacciones -DestinationPath backup-$(Get-Date -Format "yyyy-MM-dd").zip
```

## Variables de Entorno

| Variable | Valores | Descripción |
|----------|---------|-------------|
| `HEADLESS` | `true`/`false` | Modo headless (sin interfaz gráfica) |

## Cambios Recientes

- ✅ Filtrado por columna "Fecha & Hora" implementado
- ✅ Botón "Mostrar todos" funciona correctamente
- ✅ Descarga automática de todos los PDFs del día anterior
- ✅ Modo headless con cierre automático
- ✅ Modo visible para debugging (navegador permanece abierto)

## Soporte

Para problemas o preguntas, revisa:
1. Los logs en `logs/last-run.log`
2. El screenshot de error (si existe)
3. Ejecuta en modo visible para ver el navegador
