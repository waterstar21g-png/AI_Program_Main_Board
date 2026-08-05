@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "RAW=https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main"

echo ========================================
echo   AI_Program_Main_Board
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "components\ProductDataCollectApp.tsx" goto download
if not exist "lib\product-data-collect\runner.ts" goto download
findstr /i /c:"ProductCapture" "lib\programs\registry.tsx" >nul 2>&1
if not errorlevel 1 goto download
goto skip_download

:download
where curl >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Old folder. Install curl or download ZIP from GitHub.
  pause
  exit /b 1
)
echo [DOWNLOAD] Updating program files...
if not exist "lib\programs" mkdir "lib\programs"
if not exist "lib\product-data-collect" mkdir "lib\product-data-collect"
if not exist "components" mkdir "components"
if not exist "app\api\product-collect\run" mkdir "app\api\product-collect\run"

curl -fsSL -o "lib\programs\registry.tsx" "%RAW%/lib/programs/registry.tsx"
if errorlevel 1 goto dlfail
curl -fsSL -o "components\ProductDataCollectApp.tsx" "%RAW%/components/ProductDataCollectApp.tsx"
if errorlevel 1 goto dlfail
curl -fsSL -o "lib\product-data-collect\types.ts" "%RAW%/lib/product-data-collect/types.ts"
if errorlevel 1 goto dlfail
curl -fsSL -o "lib\product-data-collect\steps.ts" "%RAW%/lib/product-data-collect/steps.ts"
if errorlevel 1 goto dlfail
curl -fsSL -o "lib\product-data-collect\runner.ts" "%RAW%/lib/product-data-collect/runner.ts"
if errorlevel 1 goto dlfail
curl -fsSL -o "lib\product-data-collect\excel-import.ts" "%RAW%/lib/product-data-collect/excel-import.ts"
if errorlevel 1 goto dlfail
curl -fsSL -o "app\api\product-collect\run\route.ts" "%RAW%/app/api/product-collect/run/route.ts"
if errorlevel 1 goto dlfail
echo [OK] Download complete.

:skip_download
if not exist "node_modules" (
  echo [INSTALL] npm install...
  call npm install
  if errorlevel 1 goto fail
)

if not exist ".local\playwright-chromium.ok" (
  echo [INSTALL] Playwright Chromium...
  if not exist ".local" mkdir ".local"
  call npx playwright install chromium
  if not errorlevel 1 echo ok> ".local\playwright-chromium.ok"
)

echo.
echo   http://localhost:3000
echo   Press Ctrl+C to stop
echo.

start "" "http://localhost:3000"
call npm run dev:fast
pause
exit /b 0

:dlfail
echo [ERROR] Download failed. Check internet or use GitHub ZIP.
pause
exit /b 1

:fail
echo [ERROR] npm install failed.
pause
exit /b 1
