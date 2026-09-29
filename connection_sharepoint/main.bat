

@echo off
setlocal
cd /d "%~dp0"
call venv_mtto\Scripts\activate.bat
if errorlevel 1 exit /b 1


python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1


python connection_sharepoint.py

