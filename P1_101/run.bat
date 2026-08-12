@echo off
setlocal
cd /d "%~dp0"
python extract.py %*
if errorlevel 1 pause
