# AI_Program_Main_Board — Python B안

**로컬:** `D:\My_Project\AI_Program_Main_Board`  
**실행:** `run.bat` → Tkinter 보드

| # | 이름 | 폴더 | 설명 |
|---|------|------|------|
| 1 | P1 | `P1/` | ABC마트(A-RT) 카테고리 URL 추출 |
| 2 | P1_102 | `P1_102/` | P1 복제본 — 상위·중위 카테고리 입력 → 하위 카테고리명을 최종명으로 확정 (ABC마트·무신사) |
| 3 | P1_101 | `P1_101/` | 엑셀 URL 상품수 추출·출력폴더 저장 |
| 4 | P1_ZARA_DE | `P1_ZARA_DE/` | 독일자라(ZARA DE) 카테고리 URL 추출 |
| 5 | P2 | `P2/` | 더망고 대량수집 (**구 P3**) |
| 6 | P3_필터_갱신 | `P3_필터_갱신/` | 더망고 검색필터 저장상품수 갱신 |

보드 UI: `board/app.py`  
이전 Next.js 보드: `legacy-next/` (보관용)

## 별도 보드 (AI보드 프로그램 아님)

| 보드 | 폴더 | 설명 |
|------|------|------|
| **망고보드** (`Mango_Helper_AI_Board`) | `Mango_Helper_AI_Board/` | AI보드와 **별개의 독립 보드** — 자체 `run.bat`·`VERSION.txt`·`docs/`. 위 P1~P3 목록에 포함되지 않음 |

망고보드 실행: `Mango_Helper_AI_Board\run.bat` (PC 폴더 `D:\My_Project\Mango_Helper_AI_Board`)
