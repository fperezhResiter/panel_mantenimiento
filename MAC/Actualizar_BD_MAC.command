#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
python3 -B -m app.actualizar_BD "$@"
resultado=$?
read -p "Presiona Enter para cerrar..."
exit "$resultado"
