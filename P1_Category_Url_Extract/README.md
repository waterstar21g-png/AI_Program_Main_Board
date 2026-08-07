# P1_Category_Url_Extract — 카테고리 URL 배치 추출

A-RT 계열(ABC마트 등) GNB에서 상위 카테고리별 최종 URL을 엑셀로 저장합니다.
브라우저 자동화 없음 — `fetch(HTML) → 파싱`.

## 실행

```bat
run.bat
run.bat --site-name ABC마트 --site-url https://abcmart.a-rt.com/?track=W0009 --tops MEN,WOMEN,KIDS
run.bat --config config.example.json --out result.xlsx
```

인자/설정이 없으면 대화형으로 묻습니다 (Enter = ABC마트 기본값).

## 출력 엑셀 열

| 상위 카테고리명 | 중위 | 하위 | 최종 | 상위 최종 카테고리명 | 최종 카테고리 URL주소 |

이 파일은 **P2 / P3** 입력으로 그대로 쓸 수 있습니다.

## 요구사항

- Node.js 20+ (Windows 권장)
- 최초 1회 `npm install` (`run.bat`이 자동 수행)
