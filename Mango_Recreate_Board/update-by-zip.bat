@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

echo ========================================
echo   Mango_Recreate_Board  ZIP 강제 갱신
echo   (git pull / 스크립트 개별 다운로드가
echo    막히는 PC를 위한 대안 — 브라우저에서
echo    "Download ZIP" 받는 것과 동일한 효과)
echo ========================================

set "REPO=waterstar21g-png/Mango_Recreate_Board"
set "ZIP_URL=https://codeload.github.com/%REPO%/zip/refs/heads/main"
set "ZIP_FILE=%TEMP%\Mango_Recreate_Board_main.zip"
set "EXTRACT_DIR=%TEMP%\Mango_Recreate_Board_extract_%RANDOM%"

echo [1/4] 최신 소스 다운로드 중... (%ZIP_URL%)
if exist "%ZIP_FILE%" del /f /q "%ZIP_FILE%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls } catch {}; try { Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_FILE%' -UseBasicParsing -TimeoutSec 60; Write-Host '[OK] 다운로드 완료' } catch { Write-Host ('[ERROR] 다운로드 실패: ' + $_.Exception.Message) }"
if not exist "%ZIP_FILE%" (
  echo.
  echo [ERROR] 다운로드 실패 - 인터넷 연결 또는 방화벽/백신을 확인하세요.
  echo         (그래도 안되면 브라우저로 직접 받으세요:^)
  echo         https://github.com/%REPO%
  echo         초록색 Code 버튼 -^> Download ZIP
  pause
  exit /b 1
)

echo [2/4] 압축 해제 중...
if exist "%EXTRACT_DIR%" rd /s /q "%EXTRACT_DIR%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%EXTRACT_DIR%' -Force"
if not exist "%EXTRACT_DIR%\Mango_Recreate_Board-main" (
  echo [ERROR] 압축 해제 실패
  pause
  exit /b 1
)

echo [3/4] 최신 파일로 덮어쓰기 중... (기존 로그·크롬프로필 등은 보존됨)
xcopy "%EXTRACT_DIR%\Mango_Recreate_Board-main\*" "%~dp0" /E /H /Y /I >nul
if errorlevel 1 (
  echo [ERROR] 파일 복사 실패
  pause
  exit /b 1
)

echo [4/4] 임시파일 정리...
rd /s /q "%EXTRACT_DIR%" >nul 2>nul
del /f /q "%ZIP_FILE%" >nul 2>nul

echo.
echo [OK] 최신 버전으로 갱신 완료.
type "%~dp0VERSION.txt"
echo.
echo 보드를 시작합니다...
call "%~dp0run.bat" --noupdate
