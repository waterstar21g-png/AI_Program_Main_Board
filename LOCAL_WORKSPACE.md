# 로컬 작업 경로 (고정)

**앞으로 모든 로컬 작업은 아래 경로에서만 수행합니다.**

```
D:\My_Project\AI_Program_Main_Board
```

- OneDrive / `C:\Users\...` 아래는 사용하지 않습니다.
- P1/P2/P3 각 폴더의 `run.bat`으로 실행합니다.
- 클라우드 에이전트는 GitHub에 반영하고, 로컬 PC는 이 경로에서 clone/Sync 후 실행합니다.

## 폴더 구조 (v4.0.0)

```
D:\My_Project\AI_Program_Main_Board\
  P1_Category_Url_Extract\run.bat
  P2_Product_Capture_App\run.bat
  P3_Python_Item_Collector\run.bat
```

## Git clone 후

```cmd
cd /d D:\My_Project\AI_Program_Main_Board\P1_Category_Url_Extract
run.bat

cd /d D:\My_Project\AI_Program_Main_Board\P3_Python_Item_Collector
run.bat
```

P1·P2는 최초 `run.bat` 시 해당 폴더에서 `npm install`이 자동 실행됩니다.  
`node_modules`는 각 프로젝트 폴더 안에만 생기며, 복사할 필요 없습니다.
