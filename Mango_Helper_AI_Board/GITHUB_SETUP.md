# GitHub 저장소 최초 생성 (1회)

Cloud Agent 토큰으로는 신규 저장소 생성 권한이 없어, 아래 중 하나로 **GitHub에 저장소를 만든 뒤** push 하세요.

## 방법 A — GitHub 웹 (권장)

1. https://github.com/new 접속
2. Repository name: `Mango_Helper_AI_Board`
3. Public, README 추가 **하지 않음**
4. Create repository
5. 로컬에서:

```powershell
cd D:\My_Project\Mango_Helper_AI_Board
git remote add origin https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git
git push -u origin main
```

## 방법 B — AI board (`AI_Program_Main_Board`) 에서 폴더만 복사

부모 저장소의 `Mango_Helper_AI_Board/` 폴더를 새 저장소로 옮긴 뒤:

```powershell
cd D:\My_Project\Mango_Helper_AI_Board
git init -b main
git add -A
git commit -m "feat: Mango_Helper_AI_Board 초기 생성"
git remote add origin https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git
git push -u origin main
```

## 방법 C — git bundle (오프라인 이전)

`Mango_Helper_AI_Board.bundle` 파일이 있으면:

```powershell
git clone Mango_Helper_AI_Board.bundle Mango_Helper_AI_Board
cd Mango_Helper_AI_Board
git remote add origin https://github.com/waterstar21g-png/Mango_Helper_AI_Board.git
git push -u origin main
```
