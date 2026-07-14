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
  echo  [ERROR] Node.js is not installed.
  echo  1^) Install LTS from https://nodejs.org
  echo  2^) Close this window and run INSTALL-OFFICE.bat again
  echo.
  pause
  exit /b 1
)

echo  Node version:
node -v
echo.

echo  [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
  echo  [ERROR] npm install failed.
  echo  Internet check karo. Phir FIX-OFFICE.bat chalao.
  pause
  exit /b 1
)

echo  [1b] Rebuilding database module...
call npm rebuild better-sqlite3 >nul 2>nul

echo  [2/4] Building the app...
call npm run build
if errorlevel 1 (
  echo  [WARN] Build failed — FIX-OFFICE.bat later use kar sakte ho.
  echo  Abhi shortcut banayenge; start DEV mode se ho sakta hai.
)

echo  [3/4] Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcut.ps1"
if errorlevel 1 (
  echo  [WARN] Shortcut fail — use scripts\Pepsi-Start.bat or FIX-OFFICE.bat
)

echo  [4/4] Done!
echo.
echo  ========================================
echo   INSTALL COMPLETE
echo  ========================================
echo.
echo  Rozana: Desktop "Pepsi Distribution" icon
echo  Agar nahi chale: FIX-OFFICE.bat double-click
echo.
echo  Browser: http://localhost:3000/login
echo  Login: admin123
echo  Settings: settings123
echo.
echo  Sync: Settings -^> Sync -^> PC name Office + GitHub token -^> Sync Now
echo  Guide: OFFICE-ONLINE.md
echo.
pause
