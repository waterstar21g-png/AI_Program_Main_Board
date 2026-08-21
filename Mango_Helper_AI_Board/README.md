# 망고보드 (mango board) **v1.4.1**

> **공식 저장소명:** `Mango_Helper_AI_Board`  
> **PC 한 페이지 가이드:** **[PC_클론가이드.md](PC_클론가이드.md)** · 상세: **[PC_SETUP.md](PC_SETUP.md)**

| 용어 | 의미 |
|------|------|
| **망고보드** | 이 보드의 한글 약칭 |
| **mango board** | 이 보드의 영문 약칭 |
| **AI board** | 기존 `AI_Program_Main_Board` (별도 유지) |

## PC에서 빠르게 시작

```powershell
# 폴더 D:\My_Project\Mango_Helper_AI_Board 준비 후
.\망고보드_한번에설치.bat    ← ★ 이것만 실행 (clone·pip·바로가기·확인)
.\run.bat                   ← 망고보드 실행
```

**모든 프로그램 목록:** `py -3 scripts\launch.py list`  
**개별 바로가기:** `scripts\launch\` 폴더

## 포함 프로그램

| 프로그램 | 폴더 | 역할 |
|----------|------|------|
| 망고보드 메인 | `board/` | Tkinter 탭 UI |
| P1_필터단위_마진정책적용 | `P1_필터단위_마진정책적용/` | 정책명 → 체크 행 적용확인 |
| P2_필터단위_상품수변경 | `P2_필터단위_상품수변경/` | 적용상품수 일괄 갱신 |
| P2 | `P2/` | 더망고 대량수집 |
| P3_필터_갱신 | `P3_필터_갱신/` | 저장상품수 갱신 |
| P3_핏클상세페이지 | `P3_핏클상세페이지/` | FitCL 모델컷 10 + 디테일컷 5 |

레지스트리: `programs/registry.json`

## 로컬 경로 (권장)

```
D:\My_Project\Mango_Helper_AI_Board
```

## GitHub

| 저장소 | 용도 |
|--------|------|
| [Mango_Helper_AI_Board](https://github.com/waterstar21g-png/Mango_Helper_AI_Board) | **망고보드 독립 repo (목표)** |
| [AI_Program_Main_Board](https://github.com/waterstar21g-png/AI_Program_Main_Board) | 부모 repo · 브랜치 `cursor/mango-helper-ai-board-0c73` |

독립 repo 생성: `GITHUB_SETUP.md` · `scripts\publish-standalone.ps1`

## 구조

| 경로 | 역할 |
|------|------|
| `run.bat` / `망고보드_실행.bat` | 메인 실행 |
| `scripts/launch.py` | 통합 CLI 실행기 |
| `scripts/launch/` | 프로그램별 배치 바로가기 |
| `programs/registry.json` | 프로그램·경로·로그인 정의 |
| `board/app.py` | 메인 UI |
| `VERSION.txt` | 버전 단일 소스 |
| `docs/일별_사용자요건/` | 요구사항 원문 보관 |
