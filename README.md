# AI_Program_Main_Board

배치 자동화 도구 3개 — 각 폴더에서 `run.bat` 하나로 실행합니다.

**로컬 작업 경로(고정):** `D:\My_Project\AI_Program_Main_Board`

| 폴더 | 프로그램 | 실행 |
|------|----------|------|
| [P1_Category_Url_Extract](./P1_Category_Url_Extract/) | 카테고리 URL 엑셀 추출 | `run.bat` |
| [P2_Product_Capture_App](./P2_Product_Capture_App/) | 더망고 대량수집 (Node/Playwright) | `run.bat 엑셀.xlsx` |
| [P3_Python_Item_Collector](./P3_Python_Item_Collector/) | 더망고 대량수집 (Python) | `run.bat` + 엑셀 드래그 |

자세한 구성: [PROJECTS.md](./PROJECTS.md)

## 워크플로 (선택)

1. **P1** — 사이트 URL + 상위 카테고리 → 카테고리 URL 엑셀
2. **P2** 또는 **P3** — P1에서 만든 엑셀(또는 동일 양식)로 더망고 대량수집

P2와 P3는 같은 작업의 두 실행 방식입니다. 웹 컴파일 없이 가볍게 쓰려면 **P3**를 권장합니다.

## 사전 요구

| 프로젝트 | 필요 |
|----------|------|
| P1 | [Node.js](https://nodejs.org/) 18+ |
| P2 | Node.js 18+, Chrome 또는 Edge |
| P3 | [Python 3](https://www.python.org/downloads/), Chrome 또는 Edge |

## 버전

v4.0.0 — Next.js 보드 제거, 배치 3폴더 구조로 전환 (2026-08-07)
