@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 비즈보드 시작: http://127.0.0.1:8787/
python serve.py
pause
