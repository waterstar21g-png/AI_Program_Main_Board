# P2_Product_Capture_App

더망고(tmg1898) URL 엑셀 기반 상품 대량수집 **배치(CLI)** 도구입니다.  
P3(Python)과 같은 업무를 Node.js + Playwright로 수행합니다.

## 실행

```bat
run.bat 엑셀.xlsx
run.bat 엑셀.xlsx 5
```

엑셀을 `run.bat`에 드래그 앤 드롭해도 됩니다.

## 엑셀 필수 열

| 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
|----------------------|------------------------|

P1 출력 양식(`카테고리표`)을 그대로 쓰면 됩니다.

## 브라우저

- PC에 설치된 Chrome/Edge에 CDP(9222)로 연결합니다.
- 세션이 만료되면 브라우저에서 직접 로그인한 뒤 진행됩니다.
- 프로필: `.local/tmg-chromium-profile/`

## 요구 사항

- Node.js 18+
- Windows + Chrome 또는 Edge (로컬 전용)

## 수동 실행

```bat
npm install
npx tsx cli.ts 엑셀.xlsx
```
