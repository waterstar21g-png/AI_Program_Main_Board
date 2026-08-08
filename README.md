# AI_Program_Main_Board **v2.0.17** (Python B안)

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
  1) **기존 보드 종료** (`stop-board.ps1`)  
  2) GitHub에서 부트 스크립트 최신본 수신  
  3) `update-if-newer.ps1` → `VERSION`이 **다를 때만** `git pull origin main`  
  4) `run.bat --noupdate` → pip + **보드 재시작**  
- `.\run.bat` / `.\start.bat` 도 동일 체인. `--noupdate`면 갱신 생략.

아이콘이 옛 `run.bat`만 가리키면 반영이 안 됩니다. **한 번** 아래로 갱신하세요:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
git fetch origin main
git checkout main
git pull origin main
.\make-desktop-icon.cmd
```

### P2 더망고 로그인 · 1·2행 스크린샷

수집 시작 → 더망고 **로그인창이 열림** → **브라우저에서 직접 로그인**  
실행로그: **모든 입력**의 `상위 최종 카테고리명` / `최종 카테고리 URL주소` 기록  
**1·2행 전과정 스크린샷** 체크 시: 입력 1·2행 단계별 PNG 저장  
→ 보드 **[스크린샷 보기]** 또는 `P2/run-logs/<시각>/index.html` 갤러리

## 예전 Next UI

`legacy-next\` 폴더에 보관 (기본 실행 아님).
