# AI_Program_Main_Board_New (v2.0.2 · Python)

**npm / Next.js 없음.** Python만 사용합니다.

| 프로그램 | 역할 |
|----------|------|
| **P1** | 카테고리 URL 리스트 추출 → 엑셀 |
| **P2** | 더망고 대량수집 (P1 엑셀 입력) — 구 P3 |

기존 루트 `AI_Program_Main_Board`(Next P1/P2/P3)는 **그대로** 둡니다.

## 실행

```bat
cd AI_Program_Main_Board_New
run.bat
```

1. Python 설치 (PATH 포함)
2. `run.bat` → 보드 창
3. **P1** 수집 → 엑셀 저장 (자동으로 P2 목록에 추가)
4. **P2** 목록에서 선택 → **1행 검증 모드** 체크 후 수집 시작  
   - URL 1행 × 상품 3건 · 단계 스크린샷 · 실패 시 같은 행 재시도  
   - 로그: `P2/run-logs/`
   - 더망고 로그인: 보드/CLI에서 **아이디·비밀번호 요청** (또는 `--id` / `--pw`, 환경변수 `TMG_ID` / `TMG_PW`)

또는:

```bat
P2\run-verify.bat 엑셀.xlsx
P2\run-verify.bat 엑셀.xlsx --id MYID --pw MYPW
```

## 폴더

```
AI_Program_Main_Board_New/
  board/app.py      보드 UI (Tkinter)
  P1/crawl.py       카테고리 URL 추출
  P2/collect.py     더망고 수집
  requirements.txt
  run.bat
```

## 의존성

```
pip install -r requirements.txt
```

- P1: requests, beautifulsoup4, lxml, openpyxl  
- P2: playwright, openpyxl  

`node_modules` 없음.
