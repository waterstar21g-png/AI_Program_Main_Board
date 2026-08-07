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

**에러 메시지를 붙여넣지 마세요.** 아래 **한 줄만** 복사해서 PowerShell에 실행:

```powershell
$p='D:\My_Project\AI_Program_Main_Board'; $t=Join-Path $p 'run.bat'; if(-not(Test-Path $t)){Write-Host '[ERROR] run.bat missing:' $t; return}; $l=Join-Path ([Environment]::GetFolderPath('Desktop')) 'AI_Program_Main_Board.lnk'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut($l); $s.TargetPath=$t; $s.WorkingDirectory=$p; $s.WindowStyle=1; $s.Description='AI_Program_Main_Board start'; $s.IconLocation="$env:SystemRoot\System32\shell32.dll,21"; $s.Save(); Write-Host '[OK]' $l
```

또는 폴더에서 `make-desktop-icon.cmd` / `make-shortcut.bat` 더블클릭.

### 작업표시줄에 고정

소스가 있는 폴더에서:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
.\pin-taskbar.cmd
```

자동 고정이 안 되면: 바탕화면 **AI_Program_Main_Board** 우클릭 → **작업 표시줄에 고정**.
