# AI_Program_Main_Board **v2.0.86** (Python B안)

**최종 UI:** Python 심플 보드 (npm / Next.js **없음**)

| 프로그램 | 역할 |
|----------|------|
| **P1** | ABC마트(A-RT) 카테고리 URL 리스트 추출 → 엑셀 |
| **P1_101** | 엑셀 URL → 팝업닫기 → 3초대기 → 상품수 UPDATE |
| **P1_ZARA_DE** | 독일자라(ZARA DE) 카테고리 URL 리스트 추출 → 엑셀 |
| **P2** | 더망고 대량수집 (구 **P3**, P1/P1_ZARA_DE 엑셀 입력) |

로컬 경로(고정):

```
D:\My_Project\AI_Program_Main_Board
```

## 로컬에 받기 (최초 1회)

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
.\아이콘새로만들기.bat
```

이후에는 **아이콘만 클릭** (run.bat 별도 실행 불필요).

## 실행 · 머지 후 반영

- **일상 실행 / 머지 후 반영:** 바탕화면·작업표시줄 **아이콘만 클릭**  
  → `boot-from-icon.ps1`  
  1) 기존 보드 종료 (`stop-board.ps1`)  
  2) `update-if-newer.ps1` → `VERSION`이 GitHub `main`과 다를 때만 자동 갱신  
  3) 보드 재시작  
- `run.bat` / `start.bat` 은 아이콘 체인이 내부에서 호출한다. **사용자가 따로 실행할 필요 없음.**
- (v2.0.58부터) 파일 하나하나를 GitHub에서 개별로 다시 받는 단계는 없앴습니다.

아이콘이 옛 대상을 가리킬 때만(최초·아이콘 손상 시) `아이콘새로만들기.bat` 을 한 번 실행.

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
