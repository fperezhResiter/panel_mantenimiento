#!/bin/bash

cd "$(dirname "$0")/.." || {
    echo "ERROR: No se pudo acceder a la carpeta del panel."
    read -p "Presiona Enter para cerrar..."
    exit 1
}

if [ ! -f "config/requirements.txt" ] || \
   [ ! -f "scripts/reportabilidad.py" ] || \
   [ ! -f "app/servidor.py" ]; then
    echo "ERROR: Faltan archivos del portal."
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

echo "Buscando Python 3.10 o superior..."

if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
else
    echo "ERROR: Python no esta instalado."
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

$PYTHON_CMD -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)"
if [ $? -ne 0 ]; then
    echo "ERROR: Se requiere Python 3.10 o superior."
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

echo
echo "Actualizando pip..."
$PYTHON_CMD -m pip install --upgrade pip
if [ $? -ne 0 ]; then
    echo "ERROR: No se pudo actualizar pip."
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

echo
echo "Instalando dependencias..."
$PYTHON_CMD -m pip install -r config/requirements.txt

if [ $? -ne 0 ]; then
    echo
    echo "ERROR: No se pudieron instalar las dependencias."
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

echo
echo "Verificando instalacion..."
$PYTHON_CMD -m pip check && $PYTHON_CMD -B scripts/reportabilidad.py --help >/dev/null
if [ $? -ne 0 ]; then
    echo "ERROR: No se completo la verificacion del portal."
    read -p "Presiona Enter para cerrar..."
    exit 1
fi

echo
echo "Preparacion completada."
echo "Para abrir el portal ejecuta MAC/Iniciar_Panel_MAC.command"

read -p "Presiona Enter para cerrar..."
