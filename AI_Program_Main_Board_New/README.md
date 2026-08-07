# AI_Program_Main_Board_New (v2.0.0 · Python)

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
4. **P2** 목록에서 선택 → 수집 시작  
   (또는 로컬 폴더 검색 후 목록에 추가)

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
