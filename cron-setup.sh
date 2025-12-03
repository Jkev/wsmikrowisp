#!/bin/bash

# Script para configurar cron job en Linux/macOS
# Ejecuta este script para programar la ejecución automática a las 2 AM

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_PATH="$(which node)"

echo "📅 Configurando cron job para MikroWISP Scraper"
echo "   Ruta del proyecto: $PROJECT_DIR"
echo "   Ruta de Node.js: $NODE_PATH"
echo ""

# Crear entrada de cron
CRON_ENTRY="0 2 * * * cd $PROJECT_DIR && $NODE_PATH src/index.js >> logs/cron.log 2>&1"

# Verificar si ya existe
if crontab -l 2>/dev/null | grep -q "src/index.js"; then
  echo "⚠️  Ya existe una tarea programada para este script"
  echo ""
  read -p "¿Deseas reemplazarla? (s/n): " -n 1 -r
  echo ""

  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
  fi

  # Remover entrada anterior
  crontab -l 2>/dev/null | grep -v "src/index.js" | crontab -
fi

# Agregar nueva entrada
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo "✅ Cron job configurado exitosamente"
echo ""
echo "La tarea se ejecutará diariamente a las 2:00 AM"
echo ""
echo "Para verificar:"
echo "  crontab -l"
echo ""
echo "Para ver logs:"
echo "  tail -f $PROJECT_DIR/logs/cron.log"
echo ""
echo "Para remover la tarea:"
echo "  crontab -e"
echo "  (elimina la línea que contiene 'src/index.js')"
echo ""
