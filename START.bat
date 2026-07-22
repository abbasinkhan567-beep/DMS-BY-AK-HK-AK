@echo off
title Pepsi Distribution
color 0B
cd /d "%~dp0"

echo.
echo  ========================================
echo   PEPSI DISTRIBUTION - START
echo  ========================================
echo.

node -v >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js missing or not in PATH.
  echo  Install Node 22+ from https://nodejs.org
  start https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=*" %%a in ('node -v') do set FULL=%%a
set VER=%FULL:~1%
for /f "tokens=1 delims=." %%b in ("%VER%") do set /a MAJOR_NUM=%%b 2>nul
echo  Node: 
node -v
if %MAJOR_NUM% LSS 22 (
  echo  [ERROR] Node 22 or newer required.
  start https://nodejs.org
  pause
  exit /b 1
)

set PORT=3000

if not exist "node_modules\" (
  echo  [1/3] Installing packages (first time)...
  call npm install
  if errorlevel 1 (
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist ".next\BUILD_ID" (
  echo  [2/3] Building app (first time)...
  call npm run build
  if errorlevel 1 (
    echo  [ERROR] Build failed.
    pause
    exit /b 1
  )
)

echo  [3/3] Starting server on port %PORT%...
start "Pepsi Dist Server" /D "%~dp0" /MIN cmd /c "npx next start -p %PORT%"

echo.
echo  ========================================
echo   READY ? http://localhost:%PORT%/login
echo   Password: admin123
echo  ========================================
echo.
timeout /t 3 /nobreak >nul
start "" http://localhost:%PORT%/login
pause
exit /b 0
