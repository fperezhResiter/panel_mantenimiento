@echo off
setlocal
title Actualizar BD - Panel Mantenimiento

pushd "%~dp0"
if errorlevel 1 goto error_carpeta

echo Buscando Python 3.10 o superior...

py -3 -c "import sys; sys.exit(sys.version_info < (3,10))" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=py -3"
    goto validar
)

python -c "import sys; sys.exit(sys.version_info < (3,10))" >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=python"
    goto validar
)

echo ERROR: No se encontro Python 3.10 o superior.
goto error

:validar
%PYTHON_CMD% -c "import openpyxl, dotenv" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Faltan dependencias.
    echo Ejecuta Iniciar_Primera_Vez.bat.
    goto error
)

echo.
echo Actualizando la BD desde los Excel...
%PYTHON_CMD% -B -m app.actualizar_BD %*

if errorlevel 1 goto error

echo BD actualizada. Abre el panel o recarga la pagina.
pause
popd
endlocal
exit /b 0

:error
echo.
echo No se pudo actualizar la BD. Se conserva la base anterior.
pause
popd
endlocal
exit /b 1

:error_carpeta
echo ERROR: No se pudo acceder a la carpeta del panel.
pause
endlocal
exit /b 1
