# 로컬 작업 경로 (고정)

**앞으로 모든 로컬 작업은 아래 경로에서만 수행합니다.**

```
D:\My_Project\AI_Program_Main_Board
```

배치 3개만 남기는 정리안(결정 전 · 미실행): [docs/BATCH_THREE_CLEANUP_PLAN.md](./docs/BATCH_THREE_CLEANUP_PLAN.md)

- OneDrive / `C:\Users\...` 아래는 사용하지 않습니다.
- GitHub `main` 동기화·`run.bat`·바로가기·P1/P2/P3 실행 모두 이 폴더 기준입니다.
- 클라우드 에이전트는 GitHub에 반영하고, 로컬 PC는 이 경로에서 Sync/실행합니다.

## 폴더 옮길 때 (복사 항목이 3만 개+인 이유)

소스 코드는 수백 개뿐입니다. **대부분이 `node_modules`(의존성)와 `.next`/`.next-dev`(빌드 캐시)** 입니다.

| 항목 | 대략 | 복사해야 하나? |
|------|------|----------------|
| 소스·스크립트·문서 | 수백 개 | 예 |
| `node_modules/` | **2만~수만 개** | **아니오** — 대상에서 `npm install` |
| `.next/`, `.next-dev/` | 수천 개+ | **아니오** — 실행 시 다시 생성 |
| `.git/` | 수천 개 | git clone이면 예 / ZIP이면 보통 없음 |

### 권장 복사 방법

1. **복사 중이라면** `node_modules`, `.next`, `.next-dev` 는 건너뛰거나 복사 취소 후 제외하고 다시
2. 대상: `D:\My_Project\AI_Program_Main_Board`
3. 그 폴더에서:

```cmd
cd /d D:\My_Project\AI_Program_Main_Board
npm install
run.bat
```

또는 Git으로 깨끗이:

```cmd
mkdir D:\My_Project 2>nul
cd /d D:\My_Project
git clone https://github.com/waterstar21g-png/AI_Program_Main_Board.git
cd AI_Program_Main_Board
npm install
run.bat
```
