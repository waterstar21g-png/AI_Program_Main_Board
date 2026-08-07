# AI_Program_Main_Board **v2.0.4** (Python B안)

**최종 UI:** Python 심플 보드 (npm / Next.js **없음**)

| 프로그램 | 역할 |
|----------|------|
| **P1** | 카테고리 URL 리스트 추출 → 엑셀 |
| **P2** | 더망고 대량수집 (구 **P3**, P1 엑셀 입력) |

로컬 경로(고정):

```
D:\My_Project\AI_Program_Main_Board
```

## 로컬에 받기 (PowerShell)

```powershell
Set-Location D:\My_Project
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

## 실행

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
.\run.bat
```

바탕화면/작업표시줄: `.\make-desktop-icon.cmd` · `.\pin-taskbar.cmd`

## 예전 Next UI

`legacy-next\` 폴더에 보관 (기본 실행 아님).
