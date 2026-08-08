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
  2) `update-if-newer.ps1` → `VERSION`이 **다를 때만** `git pull origin main`  
  3) `run.bat --noupdate` → pip + **보드 재시작**  
- `.\run.bat` / `.\start.bat` 도 동일 체인. `--noupdate`면 갱신 생략.
- (v2.0.58부터) 파일 하나하나를 GitHub에서 개별로 다시 받는 단계는 없앴습니다
  — `git pull` 한 번이 모든 스크립트를 이미 갱신하기 때문입니다.

아이콘이 옛 `run.bat`만 가리키면 반영이 안 됩니다. **한 번** 아래로 갱신하세요:

```powershell
Set-Location D:\My_Project\AI_Program_Main_Board
git pull origin main
.\아이콘새로만들기.bat
```

또는 `.\make-desktop-icon.cmd` / `.\바로가기만들기.bat` (동일 — 바탕화면+작업표시줄 새 아이콘).

### `git pull`이 계속 실패하는 PC (사내망/방화벽 등)

`git fetch`/`git pull`이 네트워크 문제로 계속 실패하면, 저장소 폴더에서
`update-by-zip.bat`을 더블클릭하세요. GitHub에서 최신 소스를 **ZIP으로
통째로** 받아 현재 폴더에 덮어쓴 뒤 자동으로 보드를 시작합니다(브라우저로
"Download ZIP" 받아 직접 덮어쓰는 것과 동일한 효과를 자동화한 것).

### P2 더망고 로그인 · 1·2행 스크린샷

수집 시작 → 더망고 **로그인창이 열림** → **브라우저에서 직접 로그인**  
실행로그: **모든 입력**의 `상위 최종 카테고리명` / `최종 카테고리 URL주소` 기록  
**1·2행 전과정 스크린샷** 체크 시: 입력 1·2행 단계별 PNG 저장  
→ 보드 **[스크린샷 보기]** 또는 `P2/run-logs/<시각>/index.html` 갤러리

## 예전 Next UI

`legacy-next\` 폴더에 보관 (기본 실행 아님).
