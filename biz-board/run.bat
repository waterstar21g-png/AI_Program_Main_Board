@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 비즈보드 로컬 서버: http://127.0.0.1:8787
echo 휴대폰에서 같은 Wi-Fi의 PC IP:8787 로 접속 후 홈 화면에 추가하세요.
python -m http.server 8787
