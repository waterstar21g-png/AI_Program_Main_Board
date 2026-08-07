@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [업데이트] run.ps1 + 바로가기 파일을 GitHub main 에서 받는 중...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; $b='https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main'; $d='%~dp0'; foreach($f in @('run.ps1','run.bat','make-shortcut.bat','create-shortcut.ps1','바로가기만들기.bat')){ Write-Host ('  정상 '+$f); Invoke-WebRequest -Uri ($b+'/'+$f) -OutFile ($d+$f) -UseBasicParsing }; & powershell -NoProfile -ExecutionPolicy Bypass -File ($d+'create-shortcut.ps1')"
if errorlevel 1 (
  echo [실패] 다운로드/바로가기 실패
  pause
  exit /b 1
)
echo.
echo 완료. 바탕화면 AI_Program_Main_Board + 폴더에 make-shortcut.bat / 바로가기만들기.bat
echo 이제 run.bat 더블클릭
pause
