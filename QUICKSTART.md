# Guía Rápida de Instalación

## Para tu compañero - Primeros pasos

### 1. Requisitos
- Node.js 16+ instalado ([Descargar](https://nodejs.org/))
- Git instalado

### 2. Instalación (5 minutos)

```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPO>
cd wsmikrowisp

# 2. Instalar dependencias
npm install

# 3. Configurar credenciales
# Copia el archivo de ejemplo y edítalo con tus credenciales
cp src/config/credentials.example.js src/config/credentials.js

# En Windows:
copy src\config\credentials.example.js src\config\credentials.js
```

### 3. Editar credenciales

Abre `src/config/credentials.js` y configura:

```javascript
export const config = {
  loginUrl: 'http://portal.tu-subdominio.mikrowisp.net/admin/login',
  username: 'TU_USUARIO_REAL',
  password: 'TU_CONTRASEÑA_REAL',
  // ... (el resto puedes dejarlo igual)
};
```

### 4. Primera prueba

```bash
# Ejecutar en modo visible (verás el navegador)
npm run transacciones
```

Si todo funciona correctamente:
- Verás el navegador abrir
- Login automático
- Navegación a Transacciones
- Descarga de PDFs
- Los archivos estarán en `downloads/transacciones/YYYY-MM-DD/`

### 5. Modo producción

Una vez que confirmes que funciona:

```bash
# Windows PowerShell
$env:HEADLESS="true"
npm run transacciones

# Windows CMD
set HEADLESS=true && npm run transacciones

# Linux/Mac
HEADLESS=true npm run transacciones
```

## Problemas comunes

### "Cannot find module 'puppeteer'"
```bash
npm install
```

### "Credenciales inválidas"
- Verifica que copiaste bien el usuario y contraseña en `src/config/credentials.js`
- Prueba hacer login manualmente en el navegador

### No se descargan los PDFs
- Revisa el log: `logs/last-run.log`
- Ejecuta en modo visible para ver qué está pasando

## Siguiente paso

Una vez que funcione correctamente, consulta:
- `AUTOMATION_GUIDE.md` - Para programar ejecución automática diaria
- `README.md` - Documentación completa

## Contacto

Si tienes problemas, revisa:
1. Los logs en `logs/last-run.log`
2. Los screenshots en `logs/` (si hay errores)
3. Ejecuta en modo visible para ver el navegador

¡Listo! 🚀
