@echo off
chcp 65001 >nul
title 일기장 서버
cd /d "%~dp0"

rem ---- 파이썬 찾기 (py 런처 -> python 순서) ----
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY (
  python --version >nul 2>&1 && set "PY=python"
)

if not defined PY (
  echo.
  echo  [안내] 이 컴퓨터에 파이썬이 아직 없어요. 일기장 서버를 켜려면 한 번만 설치하면 돼요.
  echo.
  choice /c YN /m " 지금 자동으로 설치할까요? (Y=예, N=아니오)"
  if errorlevel 2 goto manual
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
  echo.
  echo  설치가 끝났어요. 이 창을 닫고 "일기장 시작.bat"을 다시 더블클릭해 주세요.
  pause
  exit /b
)

%PY% server.py
echo.
echo  서버가 꺼졌어요.
pause
exit /b

:manual
echo.
echo  https://www.python.org/downloads/ 에서 파이썬을 설치해 주세요.
echo  설치 첫 화면에서 "Add python.exe to PATH" 칸을 꼭 체크하세요.
start "" https://www.python.org/downloads/
pause
