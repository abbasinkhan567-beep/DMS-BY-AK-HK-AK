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
  echo  Install LTS from https://nodejs.org first.
  echo.
  pause
  exit /b 1
)

echo  [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
  echo  [ERROR] npm install failed.
  pause
  exit /b 1
)

echo  [2/4] Building the app...
call npm run build
if errorlevel 1 (
  echo  [ERROR] Build failed.
  pause
  exit /b 1
)

echo  [3/4] Creating Desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcut.ps1"
if errorlevel 1 (
  echo  [WARN] Shortcut was not created automatically - use scripts\Pepsi-Start.bat manually.
)

echo  [4/4] Done!
echo.
echo  ========================================
echo   INSTALL COMPLETE
echo  ========================================
echo.
echo  Double-click the "Pepsi Distribution" icon
echo  on the Desktop to start the app every day.
echo.
echo  Browser will open: http://localhost:3000
echo  Login password: admin123
echo  Settings password: settings123
echo  ^(change both in Settings -^> Password^)
echo.
echo  1^) Settings -^> Updates -^> paste GitHub URL
echo  2^) Settings -^> Sync -^> Sync Now
echo  Guide: OFFICE-ONLINE.md
echo.
pause
