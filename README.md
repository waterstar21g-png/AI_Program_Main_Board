# AI_Program_Main_Board **v2.0.8** (Python B안)

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

- **바탕화면/작업표시줄 아이콘** → `start.bat`  
  - 원격 `VERSION.txt`와 로컬 버전이 **다를 때만** `git pull`  
  - 같으면 pull 없이 바로 보드 실행
- 폴더에서 직접: `.\run.bat` (업데이트 없음)

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
.\make-desktop-icon.cmd
```

아이콘을 한 번 다시 만들어 `start.bat`을 가리키게 하세요.

### P2 더망고 로그인

1. 보드 P2에서 **[더망고 로그인 저장]** → ID/PW 1회 저장 (`P2/.tmg_credentials.json`, git 제외)
2. **[선택 파일로 수집 시작]** → 더망고 **실제 로그인창**이 열리고 저장 ID/PW 자동 입력

## 예전 Next UI

`legacy-next\` 폴더에 보관 (기본 실행 아님).
