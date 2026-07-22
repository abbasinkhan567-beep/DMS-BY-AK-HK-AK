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

REM Check if already running (using node instead of powershell)
node -e "http=require('http');http.get('http://localhost:%PORT%/login',r=>{process.exit(r.statusCode==200?0:1)}).on('error',()=>process.exit(1))" >nul 2>nul
if not errorlevel 1 (
  echo  Already running — opening browser...
  start "" http://localhost:%PORT%/login
  exit /b 0
)

if not exist "node_modules\" (
  echo  [1/3] Installing packages (first time — wait)...
  call npm install
  if errorlevel 1 (
    echo  [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if not exist ".next\BUILD_ID" (
  echo  [2/3] Building app (first time — wait)...
  call npm run build
  if errorlevel 1 (
    echo  [ERROR] Build failed.
    pause
    exit /b 1
  )
)

echo  [3/3] Starting server on port %PORT%...
start "Pepsi Dist Server" /D "%~dp0" /MIN cmd /c "npx next start -p %PORT%"

echo  Waiting for app to start...
set /a tries=0
:WAIT
set /a tries+=1
timeout /t 2 /nobreak >nul
node -e "http=require('http');http.get('http://localhost:%PORT%/login',r=>{process.exit(r.statusCode==200?0:1)}).on('error',()=>process.exit(1))" >nul 2>nul
if errorlevel 1 goto WAIT2
goto OK
:WAIT2
if %tries% geq 25 (
  echo  [ERROR] Server did not start. Run manually:
  echo    cd /d "%~dp0"
  echo    npm run build
  echo    npx next start -p %PORT%
  pause
  exit /b 1
)
goto WAIT

:OK
echo.
echo  ========================================
echo   READY — http://localhost:%PORT%/login
echo   Password: admin123
echo  ========================================
echo.
start "" http://localhost:%PORT%/login
pause
exit /b 0
