@echo off
setlocal
cd /d "%~dp0"
python crawl.py %*
if errorlevel 1 pause
