@echo off
title Pepsi Distribution
color 0B
cd /d "%~dp0"

echo.
echo  ========================================
echo   PEPSI DISTRIBUTION - START
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js missing.
  echo  Install Node 22+ from https://nodejs.org
  start https://nodejs.org
  pause
  exit /b 1
)

for /f "tokens=2 delims=v." %%a in ('node -v') do set MAJOR=%%a
set /a MAJOR_NUM=%MAJOR% 2>nul
echo  Node: 
node -v
if %MAJOR_NUM% LSS 22 (
  echo  [ERROR] Node 22 or newer required.
  start https://nodejs.org
  pause
  exit /b 1
)

set PORT=3000

REM Already running? open browser only
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri http://localhost:%PORT%/login -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if %errorlevel%==0 (
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

echo  Waiting for app...
set /a tries=0
:WAIT
set /a tries+=1
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri http://localhost:%PORT%/login -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if %errorlevel%==0 goto OK
if %tries% Geq 25 (
  echo  [ERROR] Server did not start. Check npm-debug.log or run manually:
  echo    cd /d "%~dp0"
  echo    npm run build
  echo    npx next start -p %PORT%
  pause
  exit /b 1
)
goto WAIT

:OK
echo.
echo  READY — http://localhost:%PORT%/login
echo  Password: admin123
echo.
start "" http://localhost:%PORT%/login
exit /b 0
