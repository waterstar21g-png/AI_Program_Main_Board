# 로컬 작업 경로 (고정)

```
D:\My_Project\AI_Program_Main_Board
```

이 경로를 기준으로 GitHub `main`과 동기화합니다.

## 폴더 구조 (v4+)

```
D:\My_Project\AI_Program_Main_Board\
  P1_Category_Url_Extract\     run.bat
  P2_Product_Capture_App\      run.bat
  P3_Python_Item_Collector\    run.bat
  README.md
  PROJECTS.md
  docs\
```

## 옮길 때

- 각 프로젝트의 `node_modules/` 는 **복사하지 말고** 해당 폴더에서 `npm install` (또는 `run.bat` 최초 실행).
- P3는 `pip install -r requirements.txt` (`run.bat`이 자동).
- OneDrive 밖(`D:\My_Project\...`)에 두는 것을 권장합니다.
