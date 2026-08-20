# 망고보드 (mango board) **v1.2.0**

공식 프로젝트명: **Mango_Helper_AI_Board**

| 용어 | 의미 |
|------|------|
| **망고보드** | 이 보드의 한글 약칭 |
| **mango board** | 이 보드의 영문 약칭 |
| **AI board** | 기존 `AI_Program_Main_Board` 약칭 (별도 유지) |

**AI board** 에서 **망고 연동(P2·P3) 소스만 복사**했습니다. AI board 원본은 삭제하지 않습니다.

## 포함 프로그램

| 프로그램 | 폴더 | 역할 |
|----------|------|------|
| P1_정책적용 | `P1_정책적용/` | 정책명 입력 → 체크된 행에 정책 선택·적용확인 |
| P2 | `P2/` | 더망고 대량수집 |
| P3_필터_갱신 | `P3_필터_갱신/` | 검색필터 저장상품수 갱신 |

로컬 경로(권장):

```
D:\My_Project\Mango_Helper_AI_Board
```

## 로컬에 받기 (최초 1회)

```powershell
Set-Location D:\My_Project
if (Test-Path .\Mango_Helper_AI_Board\.git) {
  Set-Location .\Mango_Helper_AI_Board
  git pull origin main
} else {
  if (Test-Path .\Mango_Helper_AI_Board) { Remove-Item -Recurse -Force .\Mango_Helper_AI_Board }
  git clone https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git Mango_Helper_AI_Board
  Set-Location .\Mango_Helper_AI_Board
}
```

## 실행

```powershell
.\run.bat
```

또는:

```powershell
python board\app.py
```

## 구조

| 경로 | 역할 |
|------|------|
| `P2/` | 더망고 대량수집 (AI board에서 복사) |
| `P3_필터_갱신/` | 필터 저장상품수 갱신 (AI board에서 복사) |
| `board/app.py` | 망고보드 메인 UI (P2·P3 탭) |
| `VERSION.txt` | 버전 단일 소스 |
| `docs/일별_사용자요건/` | 사용자 요구사항 원문 보관 |

## 프로그램 추가 방법

1. `programs/프로그램명/` 폴더 생성
2. `board/app.py` 의 `PROGRAMS` 리스트에 항목 추가:

```python
PROGRAMS = [
    {"id": "my_prog", "label": "MY\n프로그램", "subtitle": "설명"},
]
```

3. `_build_placeholder` 대신 전용 `_build_my_prog()` 메서드로 UI 구현

## GitHub

- 저장소: https://github.com/waterstar21g-png/Mango_Helper_AI_Board
- 기반: AI board (`AI_Program_Main_Board`) 메인 UI (Python Tkinter)
