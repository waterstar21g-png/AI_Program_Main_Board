# AI_Program_Main_Board — Windows 로컬 실행

## 고정 로컬 경로

```
D:\My_Project\AI_Program_Main_Board
```

자세한 복사·이동 안내: [LOCAL_WORKSPACE.md](./LOCAL_WORKSPACE.md)

## 실행·바로가기

| 방법 | 설명 |
|------|------|
| **바탕화면 바로가기** | `바로가기만들기.bat` 더블클릭 → `AI_Program_Main_Board.lnk` 생성 |
| **폴더에서 실행** | `run.bat` 더블클릭 |

```
D:\My_Project\AI_Program_Main_Board\run.bat
```

명령 프롬프트:

```cmd
cd /d D:\My_Project\AI_Program_Main_Board
run.bat
```

## 복사할 때 3만 개+가 나오는 이유

거의 전부 **`node_modules`**(의존성 패키지)입니다. 소스는 수백 개뿐입니다.  
`node_modules`, `.next`, `.next-dev` 는 **복사하지 말고**, 대상 폴더에서 `npm install` 하세요.

## run.bat 이 하는 일

| 순서 | 작업 |
|------|------|
| 1 | 구버전이면 GitHub에서 필요 파일 자동 다운로드 |
| 2 | `npm install` |
| 3 | Playwright Chromium 설치(필요 시) |
| 4 | 브라우저 열고 http://localhost:3000 |

## 사전 준비

- Node.js LTS: https://nodejs.org

## run.bat 이 없을 때

```cmd
cd /d D:\My_Project\AI_Program_Main_Board
curl -o run.bat https://raw.githubusercontent.com/waterstar21g-png/AI_Program_Main_Board/main/run.bat
run.bat
```

`curl` 실패 시 → GitHub **Download ZIP** → `node_modules` 없이 풀고 `npm install`

## 보드 프로그램

1. **P1_Category_Url_Extract**
2. **P2_Product_Capture_App**
3. **P3_Python_Item_Collector** (`python-collector\run.bat`)
