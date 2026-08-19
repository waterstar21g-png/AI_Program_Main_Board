@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   비즈 보드  (독립 실행)
echo ========================================

where py >nul 2>nul
if errorlevel 1 goto trypython
set "PY=py -3"
goto havepy

:trypython
where python >nul 2>nul
if errorlevel 1 goto trypython3
set "PY=python"
goto havepy

:trypython3
where python3 >nul 2>nul
if errorlevel 1 goto nopython
set "PY=python3"
goto havepy

:nopython
echo [ERROR] Python not found.
pause
exit /b 1

:havepy
if not exist "sites.local.json" if exist "sites.example.json" (
  copy /y "sites.example.json" "sites.local.json" >nul
  echo [INFO] sites.local.json 생성 — ID/PW를 채워 넣으세요
)

echo [1/2] pip install (playwright)...
pushd ..
call %PY% -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 (
  echo [ERROR] pip install failed
  popd
  pause
  exit /b 1
)
popd

echo [2/2] Biz Board server start
call %PY% server.py
if errorlevel 1 pause
