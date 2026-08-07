@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ========================================
echo   P3_Python_Item_Collector (더망고 수집)
echo ========================================

where py >nul 2>nul
if errorlevel 1 goto trypython
set "PY=py -3"
goto havepy

:trypython
where python >nul 2>nul
if errorlevel 1 goto nopython
set "PY=python"
goto havepy

:nopython
echo [오류] Python을 찾을 수 없습니다.
echo 설치: https://www.python.org/downloads/
echo 설치 화면에서 "Add python.exe to PATH" 를 체크하세요.
pause
exit /b 1

:havepy
echo [1/2] 패키지 확인 중...
call %PY% -m pip install --quiet --disable-pip-version-check -r requirements.txt
if errorlevel 1 goto pipfail
goto pipok

:pipfail
echo [오류] pip 설치에 실패했습니다.
pause
exit /b 1

:pipok
set "EXCEL=%~1"
if not "%EXCEL%"=="" goto haveexcel
echo.
echo 엑셀 파일을 run.bat 위에 드래그 앤 드롭하거나, 아래에서 경로를 입력하세요.
set /p EXCEL=엑셀 파일 경로: 

:haveexcel
if exist "%EXCEL%" goto runcollect
echo [오류] 파일을 찾을 수 없습니다: %EXCEL%
pause
exit /b 1

:runcollect
echo [2/2] 수집 시작: %EXCEL%
echo (이미 설치된 Chrome 또는 Edge를 사용합니다 — 별도 브라우저 다운로드 없음)
echo.
call %PY% collect.py "%EXCEL%"

echo.
echo 완료. 아무 키나 누르면 이 창을 닫습니다.
pause >nul
