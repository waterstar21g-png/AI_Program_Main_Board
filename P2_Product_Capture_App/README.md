# P2_Product_Capture_App

더망고(tmg1898) URL 엑셀 기반 상품 대량수집 — **Node.js + Playwright CDP** 배치 버전.

웹보드(Next.js) 없이 이 폴더만으로 실행합니다.  
같은 작업의 Python 버전은 `../P3_Python_Item_Collector` 를 쓰세요.

## 실행

엑셀을 `run.bat`에 드래그 앤 드롭:

```bat
run.bat
run.bat "C:\path\to\urls.xlsx"
run.bat "C:\path\to\urls.xlsx" 5
```

## 엑셀 양식

1행 헤더에 아래 열이 있어야 합니다 (P1 결과 파일 그대로 OK).

| 상위 최종 카테고리명 | 최종 카테고리 URL주소 |
|---|---|

## 필요 환경

- Node.js 18+
- 로컬 PC의 Chrome 또는 Edge
- **Vercel/서버 불가** (CDP는 로컬 전용)
