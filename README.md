# AI_Program_Main_Board (로컬 실행)

## Windows

**`run.bat`** 더블클릭 — 설치(최초 1회) + 실행이 한 번에 됩니다.

- 브라우저: http://localhost:3000
- 종료: 검은 창에서 **Ctrl+C**

자세한 내용: [WINDOWS_SETUP.md](./WINDOWS_SETUP.md)

## Mac / Linux

```bash
npm install
npx playwright install chromium
npm run dev:fast
```

## 포함 프로그램

| 좌측 목록 | 설명 |
|-----------|------|
| **Category_Item_Url_List** | 카테고리 URL 엑셀 추출 (API 키 불필요) |
| **상품데이터수집** | 더망고 엑셀 URL 자동 수집 (Playwright, 로컬) |

## 프로그램 추가

`lib/programs/registry.tsx` → `PROGRAMS` 배열에 항목 추가
