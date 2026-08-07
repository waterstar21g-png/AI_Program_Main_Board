# 로컬 작업 경로 (고정 · 유일)

**모든 프로그램은 여기만 사용합니다.**

```
D:\My_Project\AI_Program_Main_Board
```

`AI_Program_Main_Board_New` 폴더는 **삭제되었습니다.**  
`D:\My_Project\AI_Program_Main_Board_New` 가 있으면 지우세요.

| 프로그램 | 위치 (모두 위 폴더 안) |
|----------|------------------------|
| P1 / P2 (웹 보드) | `.\run.bat` → localhost |
| P3 (Python) | `.\python-collector\run.bat` |

---

## PowerShell — 전체 받기

```powershell
New-Item -ItemType Directory -Force -Path D:\My_Project | Out-Null
Set-Location D:\My_Project

# 잘못된 New 폴더 제거
Remove-Item -Recurse -Force .\AI_Program_Main_Board_New -ErrorAction SilentlyContinue

if (Test-Path .\AI_Program_Main_Board\.git) {
  Set-Location .\AI_Program_Main_Board
  git pull origin main
} else {
  if (Test-Path .\AI_Program_Main_Board) { Remove-Item -Recurse -Force .\AI_Program_Main_Board }
  git clone https://github.com/waterstar21g-png/AI_Program_Main_Board.git AI_Program_Main_Board
  Set-Location .\AI_Program_Main_Board
}

.\run.bat
```

또는:

```powershell
Set-Location D:\My_Project
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main/fetch-local.ps1" -OutFile fetch-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\fetch-local.ps1
```

---

## 실행

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
.\run.bat
```

P3만:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board\python-collector
.\run.bat
```

## 바탕화면 시작 아이콘

PowerShell (어디서든):

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main/install-desktop-icon.ps1" -OutFile "$env:TEMP\install-desktop-icon.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:TEMP\install-desktop-icon.ps1"
```

또는 프로젝트 폴더에서:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
.\make-shortcut.bat
```

바탕화면에 **AI_Program_Main_Board** 아이콘이 생깁니다 → 더블클릭 = `run.bat` 시작.
