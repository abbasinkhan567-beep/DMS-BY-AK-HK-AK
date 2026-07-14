@echo off
title Pepsi - Fix and Start
color 0A
cd /d "%~dp0"

echo.
echo  ========================================
echo   PEPSI - FIX AND START (Office/Home)
echo  ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js missing.
  echo  Install LTS from https://nodejs.org
  echo  Then run this file again.
  pause
  exit /b 1
)

echo  Node:
node -v
echo.

echo  [1/5] Stopping old server on port 3000...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>nul
)
timeout /t 1 /nobreak >nul

echo  [2/5] Cleaning old build cache...
if exist ".next" rmdir /s /q ".next" 2>nul
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul

echo  [3/5] Installing packages (this can take a few minutes)...
call npm install
if errorlevel 1 (
  echo  [ERROR] npm install failed.
  echo  Tips: internet on rakho, Node LTS install karo, phir dobara.
  pause
  exit /b 1
)

echo  [4/5] Rebuilding native module (better-sqlite3)...
call npm rebuild better-sqlite3
if errorlevel 1 (
  echo  [WARN] rebuild failed — trying full install again...
  call npm install better-sqlite3 --force
)

echo  [5/5] Building app...
call npm run build
if errorlevel 1 (
  echo.
  echo  [WARN] Production build failed — starting DEV mode instead...
  start "Pepsi Dist Dev" /D "%~dp0" /MIN cmd /c "npm run dev"
  goto WAIT_OPEN
)

echo.
echo  Starting server...
start "Pepsi Dist Server" /D "%~dp0" /MIN cmd /c "npm start"

:WAIT_OPEN
echo  Waiting for server (up to 40 seconds)...
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
echo  ========================================
echo   READY
echo  ========================================
echo  Open: http://localhost:3000/login
echo  Password: admin123
echo.
start "" http://localhost:3000/login
pause
exit /b 0

:FAIL
echo.
echo  [ERROR] Server start nahi hua.
echo  Node LTS install karo: https://nodejs.org
echo  Phir FIX-OFFICE.bat dobara chalao.
echo.
pause
exit /b 1
