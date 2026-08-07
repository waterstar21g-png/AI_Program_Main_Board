# AI_Program_Main_Board **v2.0.9** (Python B안)

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

- **바탕화면/작업표시줄 아이콘** → `boot-from-icon.ps1`  
  1) GitHub에서 `update-if-newer.ps1` 최신본 수신  
  2) 로컬/원격 `VERSION`이 **다를 때만** `git pull`  
  3) 보드 실행  
- `.\run.bat` 도 동일(버전 같을 때 pull 생략). `--noupdate`면 검사 생략.

아이콘이 옛 `run.bat`만 가리키면 반영이 안 됩니다. **한 번** 아래로 갱신하세요:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
git fetch origin main
git checkout main
git pull origin main
.\make-desktop-icon.cmd
```

### P2 더망고 로그인

1. 보드 P2에서 **[더망고 로그인 저장]** → ID/PW 1회 저장 (`P2/.tmg_credentials.json`, git 제외)
2. **[선택 파일로 수집 시작]** → 더망고 **실제 로그인창**이 열리고 저장 ID/PW 자동 입력

## 예전 Next UI

`legacy-next\` 폴더에 보관 (기본 실행 아님).
