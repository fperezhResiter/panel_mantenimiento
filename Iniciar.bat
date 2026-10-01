@echo off
rem Acceso de inicio diario del portal.
call "%~dp0Iniciar_Panel.bat" %*
exit /b %errorlevel%
