export const config = {
  loginUrl: 'https://portal.tu-subdominio.mikrowisp.net/admin/login',
  username: 'TU_USUARIO',
  password: 'TU_CONTRASEÑA',

  // Configuración de timeouts
  navigationTimeout: 60000,
  waitTimeout: 5000,

  // Configuración de reintentos
  maxRetries: 3,
  retryDelay: 2000,

  // Configuración de descargas
  downloadPath: './downloads',
  logsPath: './logs'
};
