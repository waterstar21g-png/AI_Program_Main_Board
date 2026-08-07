# AI 에이전트 가이드 (AI_Program_Main_Board)

## 대화 언어

**한국어**로 사용자와 대화합니다. 자세한 규칙은 `.cursor/rules/korean-communication.mdc`를 따릅니다.

## 프로젝트 개요

가볍고 단순한 배치 자동화 모노레포입니다.

| 프로그램 | 설명 |
|----------|------|
| **P1_Category_Url_Extract** | 카테고리별 상품 URL 리스트 추출 |
| **P2_Product_Capture_App** | 더망고 URL 엑셀 기반 상품 대량수집 (Next.js + Playwright) |
| **P3_Python_Item_Collector** | P2와 동일 작업의 파이썬 독립 버전 (`python-collector/`) |

## 로컬 작업 경로 (Windows)

```
D:\My_Project\AI_Program_Main_Board
```

## 실행

- Windows: `run.bat` 또는 `run.ps1` (동기화: `run.ps1 -Sync`)
- Mac/Linux: `npm install` 후 `npm run dev`
- P3만: `python-collector/run.bat`

## 사용자 요구사항 보관 (SR)

커밋 시 `docs/일별_사용자요건/SR_doc_YYYYMMDD_HHMMSS_요건요약20자이내.md` 형식으로 사용자 요청 **원문**을 보관합니다. 규칙은 `docs/일별_사용자요건/README.md`를 참고합니다.

## 버전

`VERSION.txt`, `lib/app-version.ts`, `run.ps1`의 `ExpectedVersion`을 함께 맞춥니다.
