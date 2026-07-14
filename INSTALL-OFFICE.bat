@echo off
title Pepsi Distribution - Office Install
color 0B
cd /d "%~dp0"

echo.
echo  ========================================
echo   PEPSI DISTRIBUTION - OFFICE INSTALL
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js missing.
  echo  Install latest Node ^(22+^) from https://nodejs.org
  start https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set MAJOR=%%a
echo  Node version:
node -v
set /a MAJOR_NUM=%MAJOR%
if %MAJOR_NUM% LSS 22 (
  echo  [ERROR] Node 22+ required.
  start https://nodejs.org
  pause
  exit /b 1
)

echo  %CD% | findstr /I "OneDrive" >nul
if %errorlevel%==0 (
  echo  [WARN] OneDrive path — prefer C:\Pepsi
  echo.
)

echo  [1/3] Installing dependencies...
call npm install
if errorlevel 1 (
  echo  [ERROR] npm install failed. Phir FIX-OFFICE.bat chalao.
  pause
  exit /b 1
)

echo  [2/3] Building the app...
call npm run build
if errorlevel 1 (
  echo  [WARN] Build failed — FIX-OFFICE.bat use karo.
)

echo  [3/3] Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcut.ps1"
if errorlevel 1 (
  echo  [WARN] Shortcut fail — use FIX-OFFICE.bat
)

echo.
echo  DONE. Rozana Desktop icon ya FIX-OFFICE.bat
echo  Login: admin123
echo  Sync guide: OFFICE-SIMPLE.md
echo.
pause
