# MikroWISP Scraper - Descarga Automática de Transacciones

Script automatizado para descargar facturas de transacciones desde MikroWISP usando Puppeteer.

## 📋 Requisitos Previos

- **Node.js** versión 16 o superior ([Descargar aquí](https://nodejs.org/))
- **Git** ([Descargar aquí](https://git-scm.com/))
- Acceso a MikroWISP con credenciales válidas

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd wsmikrowisp
```

### 2. Instalar dependencias

```bash
npm install
```

Esto instalará:
- `puppeteer` - Automatización del navegador
- `date-fns` - Manejo de fechas
- `winston` - Sistema de logging

### 3. Configurar credenciales

Edita el archivo `src/config/credentials.js` con tus credenciales de MikroWISP:

```javascript
export const credentials = {
  username: 'TU_USUARIO',
  password: 'TU_CONTRASEÑA',
  url: 'https://tu-subdominio.mikrowisp.net'
};
```

**⚠️ IMPORTANTE:** Nunca subas este archivo a Git con tus credenciales reales. El archivo ya está en `.gitignore`.

## 📖 Uso

### Modo Manual (con navegador visible)

Para ver el navegador mientras se ejecuta (útil para debugging):

```bash
npm run transacciones
```

El navegador permanecerá abierto al finalizar para que puedas revisar.

### Modo Headless (sin navegador visible)

Para ejecutar en segundo plano (ideal para producción/automatización):

```bash
# Windows PowerShell
$env:HEADLESS="true"
npm run transacciones

# Windows CMD
set HEADLESS=true && npm run transacciones

# Linux/Mac
HEADLESS=true npm run transacciones
```

### Con Logging Persistente

Para guardar logs con fecha:

```bash
npm run transacciones:log
```

## 🗂️ Estructura de Archivos

```
wsmikrowisp/
├── src/
│   ├── config/
│   │   └── credentials.js          # ⚠️ Configurar con tus credenciales
│   ├── download-transacciones.js   # Script principal de producción
│   ├── test-transacciones.js       # Script de testing
│   └── ...
├── downloads/
│   └── transacciones/
│       └── YYYY-MM-DD/             # PDFs organizados por fecha
│           ├── MX$350.00_5908_Cliente_Nombre.pdf
│           └── download-report.json
├── logs/
│   ├── last-run.log                # Última ejecución
│   └── transacciones-YYYY-MM-DD.log
├── package.json
└── README.md
```

## 🤖 Automatización

### Windows - Task Scheduler

1. Abrir "Programador de tareas" (Task Scheduler)
2. Crear Tarea Básica:
   - **Nombre:** "MikroWISP Transacciones Diarias"
   - **Desencadenador:** Diariamente a las 3:00 AM
   - **Acción:** Ejecutar script batch (ver `AUTOMATION_GUIDE.md`)

### Linux/Mac - Cron

```bash
# Editar crontab
crontab -e

# Agregar línea para ejecutar todos los días a las 3 AM
0 3 * * * cd /ruta/completa/wsmikrowisp && HEADLESS=true npm run transacciones >> logs/cron.log 2>&1
```

**Ver guía completa en:** `AUTOMATION_GUIDE.md`

## ❓ Solución de Problemas

### Error: "Cannot find module 'puppeteer'"

```bash
npm install
```

### Error: "Credenciales inválidas"

1. Verifica que `src/config/credentials.js` tenga tus credenciales correctas
2. Prueba hacer login manualmente en tu navegador

### El navegador no se cierra automáticamente

- Asegúrate de ejecutar con `HEADLESS=true`
- En modo visible, el navegador permanece abierto intencionalmente

### No se descargan los PDFs

1. Revisa el log: `logs/last-run.log`
2. Revisa el screenshot de error: `logs/transacciones-error.png`
3. Ejecuta en modo visible: `npm run transacciones`

### Error: "npm: command not found"

- Instala Node.js desde [nodejs.org](https://nodejs.org/)
- Reinicia la terminal después de instalar

## 📊 ¿Qué hace el script?

1. **Login automático** - Inicia sesión en MikroWISP
2. **Navega a Transacciones** - Va a la sección de transacciones
3. **Filtra por fecha** - Selecciona el día anterior
4. **Carga todos los registros** - Hace click en "Mostrar todos"
5. **Descarga PDFs** - Descarga todas las facturas del día anterior
6. **Genera reporte** - Crea un JSON con resumen de la descarga

## 🔐 Seguridad

- **NUNCA** subas `src/config/credentials.js` a Git
- El archivo ya está en `.gitignore` para prevenir esto
- Considera usar variables de entorno para producción

## 🛠️ Scripts Disponibles

```bash
npm run transacciones          # Ejecutar en modo visible
npm run transacciones:log      # Ejecutar con logging persistente
npm run test-transacciones     # Versión de testing
```

## 📝 Variables de Entorno

| Variable | Valores | Descripción |
|----------|---------|-------------|
| `HEADLESS` | `true`/`false` | Ejecutar sin interfaz gráfica |

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en `logs/last-run.log`
2. Revisa los screenshots de error en `logs/`
3. Ejecuta en modo visible para debugging
4. Consulta `AUTOMATION_GUIDE.md` para más detalles

## 📄 Licencia

MIT

---

**Desarrollado para automatizar la descarga de transacciones de MikroWISP**
