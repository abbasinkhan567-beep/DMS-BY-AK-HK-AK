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
  echo  Install ONLY Node 20 LTS from https://nodejs.org
  echo  ^(green LTS — not Current/24^)
  start https://nodejs.org/en/download/prebuilt-installer
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set MAJOR=%%a
echo  Node version:
node -v
if "%MAJOR%"=="24" goto BAD_NODE
if "%MAJOR%"=="25" goto BAD_NODE
if "%MAJOR%"=="23" goto BAD_NODE
goto NODE_OK

:BAD_NODE
echo  [ERROR] Node %MAJOR% unsupported.
echo  Uninstall it, install Node 20 LTS, see OFFICE-SIMPLE.md
start https://nodejs.org/en/download/prebuilt-installer
pause
exit /b 1

:NODE_OK

echo  %CD% | findstr /I "OneDrive" >nul
if %errorlevel%==0 (
  echo  [WARN] OneDrive path detected. Prefer C:\Pepsi — see OFFICE-SIMPLE.md
  echo.
)

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
