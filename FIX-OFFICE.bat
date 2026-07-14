@echo off
title Pepsi - Fix and Start
color 0A
cd /d "%~dp0"

echo.
echo  ========================================
echo   PEPSI - FIX AND START
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js missing.
  echo  Install latest Node from https://nodejs.org
  start https://nodejs.org
  pause
  exit /b 1
)

echo  Node:
node -v
echo.

for /f "tokens=1 delims=v." %%a in ('node -v') do set MAJOR=%%a
set /a MAJOR_NUM=%MAJOR%
if %MAJOR_NUM% LSS 22 (
  echo  [ERROR] Node 22+ required ^(built-in SQLite^).
  echo  Install latest from https://nodejs.org
  start https://nodejs.org
  pause
  exit /b 1
)

echo  %CD% | findstr /I "OneDrive" >nul
if %errorlevel%==0 (
  echo  [WARN] OneDrive path — better use C:\Pepsi
  echo.
)

echo  [1/4] Stopping old server on port 3000...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>nul
)
timeout /t 1 /nobreak >nul

echo  [2/4] Cleaning old build / old native modules...
if exist ".next" rmdir /s /q ".next" 2>nul
if exist "node_modules\better-sqlite3" rmdir /s /q "node_modules\better-sqlite3" 2>nul
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul

echo  [3/4] Installing packages (simple — no Visual Studio needed)...
call npm install
if errorlevel 1 (
  echo  [ERROR] npm install failed. Internet check karo.
  pause
  exit /b 1
)

echo  [4/4] Building...
call npm run build
if errorlevel 1 (
  echo  Build fail — starting DEV mode...
  start "Pepsi Dist Dev" /D "%~dp0" /MIN cmd /c "npm run dev"
  goto WAIT_OPEN
)

start "Pepsi Dist Server" /D "%~dp0" /MIN cmd /c "npm start"

:WAIT_OPEN
echo  Waiting for server...
set /a tries=0
:WAIT_LOOP
set /a tries+=1
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if %errorlevel%==0 goto OK
if %tries% Geq 20 goto FAIL
goto WAIT_LOOP

:OK
echo.
echo  READY: http://localhost:3000/login
echo  Password: admin123
start "" http://localhost:3000/login
pause
exit /b 0

:FAIL
echo  Server start fail. Node version check: node -v ^(22+ chahiye^)
pause
exit /b 1
