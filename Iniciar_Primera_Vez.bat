@echo off
setlocal
title Preparacion inicial - Portal de mantenimiento
pushd "%~dp0"
if errorlevel 1 goto error_carpeta

if not exist "requirements.txt" goto error_archivos
if not exist "reportabilidad.py" goto error_archivos
if not exist "app\servidor.py" goto error_archivos
set "PANEL_PYTHON=%~dp0venv_mtto\Scripts\python.exe"
if exist "venv_mtto" goto validar_entorno

echo Buscando Python 3.10 o superior...
py -3 -c "import sys; sys.exit(sys.version_info < (3,10))" >nul 2>&1
if not errorlevel 1 goto crear_con_py
python -c "import sys; sys.exit(sys.version_info < (3,10))" >nul 2>&1
if not errorlevel 1 goto crear_con_python
echo ERROR: Instala Python 3.10 o superior y habilita el lanzador py o Python en PATH.
goto error

:crear_con_py
py -3 -m venv "venv_mtto"
if errorlevel 1 goto error
goto validar_entorno

:crear_con_python
python -m venv "venv_mtto"
if errorlevel 1 goto error

:validar_entorno
echo Comprobando venv_mtto...
if not exist "%PANEL_PYTHON%" goto error_entorno
"%PANEL_PYTHON%" -c "import sys; assert sys.version_info >= (3,10); assert sys.prefix != sys.base_prefix"
if errorlevel 1 goto error_entorno

echo Preparando pip dentro de venv_mtto...
"%PANEL_PYTHON%" -m ensurepip --upgrade
if errorlevel 1 goto error
echo Instalando dependencias. Este paso requiere acceso a Internet.
"%PANEL_PYTHON%" -m pip install --upgrade pip
if errorlevel 1 goto error
"%PANEL_PYTHON%" -m pip install -r "requirements.txt"
if errorlevel 1 goto error
"%PANEL_PYTHON%" -m pip check
if errorlevel 1 goto error
"%PANEL_PYTHON%" -B reportabilidad.py --help >nul
if errorlevel 1 goto error

echo.
echo Preparacion completada. Para abrir el portal ejecuta Iniciar_Panel.bat.
echo Verifica que el Excel de mantenimiento este disponible y sincronizado en este equipo.
pause
popd
endlocal
exit /b 0

:error_entorno
echo ERROR: venv_mtto esta incompleto, danado o utiliza un Python incompatible.
echo Renombra esa carpeta como respaldo y vuelve a ejecutar este archivo.
goto error

:error_archivos
echo ERROR: Faltan archivos del portal. Conserva este BAT en la carpeta del panel.
goto error

:error
echo.
echo No se completo la preparacion. Revisa el error anterior.
echo Si fallo la descarga, revisa Internet y vuelve a ejecutar este archivo.
pause
popd
endlocal
exit /b 1

:error_carpeta
echo ERROR: No se pudo acceder a la carpeta del panel.
pause
endlocal
exit /b 1
