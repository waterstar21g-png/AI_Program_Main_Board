# AI_Program_Main_Board (로컬 실행)

## Windows

**`run.bat`** 더블클릭 — 이 파일 하나로 전부 처리됩니다.

1. 구버전이면 GitHub에서 필요 파일 자동 다운로드  
2. `npm install` (최초 1회)  
3. Playwright Chromium (최초 1회)  
4. http://localhost:3000 실행  

`start.bat` / `setup.bat` 도 같은 동작입니다.

## Mac / Linux

```bash
npm install
npx playwright install chromium
npm run dev:fast
```

## 포함 프로그램 (보드)

| 프로그램 | 설명 |
|----------|------|
| **Category_Item_Url_List** | 카테고리 URL 엑셀 추출 |
| **상품데이터수집** | 더망고 엑셀 URL 자동 수집 |

## run.bat 없을 때 (최초 1회만)

```cmd
curl -o run.bat https://raw.githubusercontent.com/waterstar21g-png/sangpum-capture-price/main/run.bat
run.bat
```
