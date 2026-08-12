# AI_Program_Main_Board **v2.1.14** (Python B안)

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

바탕화면에 **아이콘 2개**, 작업표시줄에도 **둘 다** 둡니다 (`아이콘새로만들기.bat` 1회):

| 아이콘 | 역할 |
|--------|------|
| **AI_보드_버전갱신** | 보드 종료 → GitHub `main` **강제** 반영 → 보드 재시작 (바로가기) |
| **AI_Program_Main_Board** | 메인보드 실행 |

- **머지 후 권장:** `AI_보드_버전갱신` 클릭 한 번 (버전 숫자가 바뀌는지 확인)
- 보드 좌측 하단 **「머지반영 업데이트」** 도 동일하게, 보드를 **종료한 뒤** 외부 강제갱신 후 재시작합니다.  
  (실행 중 pull 하면 Windows 파일 잠금으로 버전이 안 바뀌던 문제 수정)
- (v2.0.58부터) 파일 하나하나를 GitHub에서 개별로 다시 받는 단계는 없앴습니다.
- (v2.1.2) 작업표시줄에 **메인보드 + 버전갱신(바로가기)** 둘 다 고정(복사+핀 시도).

아이콘이 없거나 생성 실패하면 `아이콘새로만들기.bat` 또는 `make-desktop-icon.cmd` 을 한 번 실행.
실패 시 `icon-last.log` 를 확인하고, 프로젝트 폴더에 생긴 `.lnk` 를 바탕화면으로 드래그해도 됩니다.

또는 `.\바로가기만들기.bat` (동일 — 바탕화면+작업표시줄에 메인보드·버전갱신 둘 다).

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
