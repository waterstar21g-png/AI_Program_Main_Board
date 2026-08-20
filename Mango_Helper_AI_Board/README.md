# 망고보드 (mango board) **v1.0.2**

공식 프로젝트명: **Mango_Helper_AI_Board**

| 용어 | 의미 |
|------|------|
| **망고보드** | 이 보드의 한글 약칭 |
| **mango board** | 이 보드의 영문 약칭 |
| **AI 메인보드** | 기존 `AI_Program_Main_Board` (구분 대상) |

**AI 메인보드**의 **메인 UI 셸만** 복사한 신규 보드입니다.  
신규 프로그램은 `programs/` 폴더에 추가하고 `board/app.py` 의 `PROGRAMS` 목록에 등록합니다.

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
| `board/app.py` | 망고보드 메인 UI (헤더·사이드바·프로그램 탭) |
| `board/terms.py` | 용어 정의 (망고보드 / mango board) |
| `board/self_update.py` | 머지반영 업데이트 (GitHub main 강제 반영) |
| `programs/` | 신규 프로그램 추가 폴더 |
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
- 기반: AI_Program_Main_Board 메인 UI (Python Tkinter)
