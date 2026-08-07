# 로컬 작업 경로 (고정)

**모든 프로그램은 아래 한 폴더에만 둡니다.**

```
D:\My_Project\AI_Program_Main_Board
```

| 항목 | 경로 |
|------|------|
| 루트(Next 보드) | `D:\My_Project\AI_Program_Main_Board\` |
| New(Python P1+P2) | `D:\My_Project\AI_Program_Main_Board\AI_Program_Main_Board_New\` |
| P3 | `D:\My_Project\AI_Program_Main_Board\python-collector\` |

> PowerShell 에서는 `cd /d`, `2>nul`, `curl -L -o` (CMD 문법) 를 쓰지 마세요.

---

## PowerShell — 전체 받기 (권장)

아래를 **한 줄씩** 실행합니다. 저장소 전체가  
`D:\My_Project\AI_Program_Main_Board` 안으로 들어갑니다.

### A. Git 있을 때 (가장 깨끗)

```powershell
New-Item -ItemType Directory -Force -Path D:\My_Project | Out-Null
Set-Location D:\My_Project
if (Test-Path .\AI_Program_Main_Board\.git) {
  Set-Location .\AI_Program_Main_Board
  git pull origin main
} else {
  if (Test-Path .\AI_Program_Main_Board) { Remove-Item -Recurse -Force .\AI_Program_Main_Board }
  git clone https://github.com/waterstar21g-png/AI_Program_Main_Board.git AI_Program_Main_Board
  Set-Location .\AI_Program_Main_Board
}
Set-Location .\AI_Program_Main_Board_New
.\run.bat
```

### B. Git 없이 ZIP

```powershell
New-Item -ItemType Directory -Force -Path D:\My_Project\AI_Program_Main_Board | Out-Null
Set-Location D:\My_Project\AI_Program_Main_Board
Invoke-WebRequest -Uri "https://github.com/waterstar21g-png/AI_Program_Main_Board/archive/refs/heads/main.zip" -OutFile ".\main.zip"
Expand-Archive -Path ".\main.zip" -DestinationPath ".\_tmp" -Force
Copy-Item -Path ".\_tmp\AI_Program_Main_Board-main\*" -Destination ".\" -Recurse -Force
Remove-Item -Recurse -Force ".\_tmp", ".\main.zip"
Set-Location .\AI_Program_Main_Board_New
.\run.bat
```

### 잘못 받은 경우 (지금처럼 `D:\My_Project\AI_Program_Main_Board_New` 만 생긴 경우)

`D:\My_Project` 바로 아래의 `AI_Program_Main_Board_New` 는 지우고, 위 **A** 또는 **B** 로  
`D:\My_Project\AI_Program_Main_Board` 안에 다시 받으세요.

```powershell
# 잘못된 위치 정리 (선택)
Remove-Item -Recurse -Force D:\My_Project\AI_Program_Main_Board_New -ErrorAction SilentlyContinue
```

---

## CMD (명령 프롬프트) — PowerShell 아닐 때만

```cmd
mkdir D:\My_Project
cd /d D:\My_Project
git clone https://github.com/waterstar21g-png/AI_Program_Main_Board.git AI_Program_Main_Board
cd AI_Program_Main_Board\AI_Program_Main_Board_New
run.bat
```

---

## 실행

```powershell
# New 보드 (Python · npm 없음)
Set-Location D:\My_Project\AI_Program_Main_Board\AI_Program_Main_Board_New
.\run.bat

# 기존 Next 보드
Set-Location D:\My_Project\AI_Program_Main_Board
.\run.bat
```

`node_modules` / `.next` 는 복사하지 마세요. Next 보드를 쓸 때만 그 폴더에서 `npm install`.
