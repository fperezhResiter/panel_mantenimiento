@echo off
setlocal
title Panel de reportabilidad - Resiter Mineria
pushd "%~dp0"
if errorlevel 1 goto error_carpeta

if not exist "venv_mtto\Scripts\activate.bat" (
    echo ERROR: No se encontro venv_mtto en la carpeta del panel.
    echo Ejecuta Iniciar_Primera_Vez.bat para preparar el entorno.
    goto error
)

echo Activando venv_mtto...
call "venv_mtto\Scripts\activate.bat"
if errorlevel 1 goto error
set "PANEL_PYTHON=%~dp0venv_mtto\Scripts\python.exe"
"%PANEL_PYTHON%" -c "import sys; assert sys.version_info >= (3,10), 'Se requiere Python 3.10 o superior'"
if errorlevel 1 goto error

"%PANEL_PYTHON%" -c "import openpyxl" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Falta openpyxl en venv_mtto.
    echo Ejecuta este comando desde la carpeta del proyecto:
    echo venv_mtto\Scripts\python.exe -m pip install -r requirements.txt
    goto error
)

echo.
echo Iniciando el panel. Cuando aparezca Panel disponible, abre la URL indicada.
echo Manten esta ventana abierta. Para detener el servidor pulsa Ctrl+C.
echo.
"%PANEL_PYTHON%" reportabilidad.py %*
if errorlevel 1 goto error
popd
endlocal
exit /b 0

:error
echo.
echo No se pudo iniciar el panel. Revisa el mensaje anterior y README.md.
pause
popd
endlocal
exit /b 1

:error_carpeta
echo ERROR: No se pudo acceder a la carpeta del panel.
pause
endlocal
exit /b 1
