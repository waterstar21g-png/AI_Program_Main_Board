@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 비즈보드 로컬 서버 시작...
python serve.py
pause
