/**
 * Selectores CSS y configuración de navegación para MikroWISP
 * Actualizados basándose en las capturas del sitio real
 */

export const selectors = {
  // Selectores de login
  login: {
    emailInput: 'input[name="mail"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button', // Se busca por texto "Ingresar"
  },

  // Selectores de navegación
  navigation: {
    sidebar: 'aside, nav, [class*="sidebar"]',
    // Se navega por texto "Finanzas" y "Facturas"
    finanzasMenu: null, // Búsqueda por texto
    facturasSubmenu: null, // Búsqueda por texto
  },

  // Selectores de la página de facturas
  facturas: {
    // Filtros de fecha (inputs visibles en la captura)
    // Los inputs de fecha están en la parte superior
    // Formato: DD/MM/YYYY
    dateFromInput: 'input[type="date"]', // Primer input de fecha
    dateToInput: 'input[type="date"]:nth-of-type(2)', // Segundo input de fecha

    // Si los inputs son de tipo text con datepicker
    dateInputs: 'input[placeholder*="fecha"], input[type="date"]',

    // Tabla de resultados
    table: 'table',
    tableRows: 'table tbody tr',
    noResults: '[class*="empty"], [class*="no-data"]',

    // Estructura de columnas según la captura:
    // 0: N° FACTURA
    // 1: N° CÉDULA
    // 2: TIPO
    // 3: CLIENTE
    // 4: F. EMITIDO
    // 5: F. VENCIMIENTO
    // 6: F. PAGADO
    // 7: TOTAL
    // 8: SALDO
    // 9: FORMA DE PAGO
    // 10: N° IDENTIFICACIÓN
    // 11: ESTADO
    // 12+: Acciones (iconos)

    columnIndexes: {
      invoiceNumber: 0,    // N° FACTURA
      clientId: 1,          // N° CÉDULA
      type: 2,              // TIPO
      clientName: 3,        // CLIENTE
      issueDate: 4,         // F. EMITIDO
      dueDate: 5,           // F. VENCIMIENTO
      paidDate: 6,          // F. PAGADO
      total: 7,             // TOTAL
      balance: 8,           // SALDO
      paymentMethod: 9,     // FORMA DE PAGO
      identification: 10,   // N° IDENTIFICACIÓN
      status: 11,           // ESTADO
      actions: 12           // Acciones (botones)
    },

    // Botones de acción en cada fila (iconos)
    actionButtons: {
      print: 'button[title*="Imprimir"], button[title*="PDF"], i[class*="print"]',
      view: 'button[title*="Ver"], i[class*="eye"]',
      check: 'button[title*="Marcar"]',
      delete: 'button[title*="Eliminar"], button[title*="Anular"]'
    },

    // Paginación (visible en la parte inferior derecha)
    pagination: {
      nextButton: 'button:has(i[class*="chevron-right"]), button:has(i[class*="next"])',
      prevButton: 'button:has(i[class*="chevron-left"]), button:has(i[class*="prev"])',
      pageNumbers: 'button[class*="page"]',
      activePageClass: 'active',
    },

    // Loader/Spinner
    loader: '[class*="spinner"], [class*="loader"], [class*="loading"]',
  },
};

/**
 * Textos para búsqueda de elementos
 */
export const searchTexts = {
  finanzas: ['Finanzas', 'Finance', 'Billing'],
  facturas: ['Facturas', 'Invoices', 'Factura'],
  descargar: ['Descargar', 'Download', 'PDF', 'Imprimir', 'Print'],
  filtrar: ['Filtrar', 'Filter', 'Buscar', 'Search'],
};

/**
 * Configuración de espera y timeouts
 */
export const waitConfig = {
  afterClick: 2000, // Espera después de hacer click
  afterNavigation: 3000, // Espera después de navegar
  forElement: 5000, // Timeout para esperar un elemento
  forTableLoad: 10000, // Timeout para esperar que cargue la tabla
  betweenDownloads: 1000, // Espera entre descargas de PDFs
};

export default { selectors, searchTexts, waitConfig };
