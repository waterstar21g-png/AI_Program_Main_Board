# AI_Program_Main_Board — Windows 로컬 실행

## 고정 로컬 경로

```
D:\My_Project\AI_Program_Main_Board
```

자세한 복사·이동 안내: [LOCAL_WORKSPACE.md](./LOCAL_WORKSPACE.md)

## 실행

| 프로그램 | 실행 |
|----------|------|
| P1 카테고리 URL 추출 | `P1_Category_Url_Extract\run.bat` |
| P2 더망고 수집 (Node) | `P2_Product_Capture_App\run.bat` + 엑셀 |
| P3 더망고 수집 (Python) | `P3_Python_Item_Collector\run.bat` + 엑셀 드래그 |

```cmd
cd /d D:\My_Project\AI_Program_Main_Board\P1_Category_Url_Extract
run.bat
```

## 사전 준비

| 프로젝트 | 필요 |
|----------|------|
| P1, P2 | [Node.js](https://nodejs.org/) LTS |
| P3 | [Python 3](https://www.python.org/downloads/) (PATH 체크) |
| P2, P3 | Chrome 또는 Edge (더망고 로그인용) |

## P2 로그인 순서

1. `P2_Product_Capture_App\run.bat --open-only` — 브라우저에서 로그인
2. `run.bat 엑셀파일.xlsx` — 수집 시작

P3는 `run.bat` 실행 후 브라우저에서 로그인하면 됩니다 (README 참고).
