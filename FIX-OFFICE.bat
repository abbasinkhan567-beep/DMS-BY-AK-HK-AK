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
  echo.
  echo  ONLY install this: Node.js 20 LTS
  echo  https://nodejs.org
  echo  ^(green LTS button — NOT "Current"^)
  echo.
  start https://nodejs.org/en/download/prebuilt-installer
  pause
  exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set MAJOR=%%a
echo  Node: 
node -v
echo.

REM better-sqlite3 needs Node 18/20/22 with prebuilt binary — Node 24 breaks office install
if "%MAJOR%"=="24" goto BAD_NODE
if "%MAJOR%"=="25" goto BAD_NODE
if "%MAJOR%"=="23" goto BAD_NODE
goto NODE_OK

:BAD_NODE
echo  ========================================
echo   WRONG NODE VERSION
echo  ========================================
echo.
echo  Tumhare PC pe Node %MAJOR% hai.
echo  Is software ke liye Node 20 LTS chahiye.
echo.
echo  1^) Control Panel -^> Uninstall Node.js
echo  2^) Install Node 20 LTS from:
echo     https://nodejs.org
echo     ^(LTS / green button^)
echo  3^) PC restart
echo  4^> Folder ko OneDrive SE BAHAR rakho:
echo     C:\Pepsi   ^(best^)
echo  5^) Yahan FIX-OFFICE.bat dobara chalao
echo.
start https://nodejs.org/en/download/prebuilt-installer
pause
exit /b 1

:NODE_OK

echo  %CD% | findstr /I "OneDrive" >nul
if %errorlevel%==0 (
  echo  [WARN] Folder OneDrive ke andar hai — problems aa sakti hain.
  echo  Behtar: folder copy karo  C:\Pepsi  mein, wahan se chalao.
  echo.
)

echo  [1/5] Stopping old server on port 3000...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%p >nul 2>nul
)
timeout /t 1 /nobreak >nul

echo  [2/5] Cleaning old install/build...
if exist ".next" rmdir /s /q ".next" 2>nul
if exist "node_modules" (
  echo  Removing old node_modules (please wait)...
  rmdir /s /q "node_modules" 2>nul
)
if exist "package-lock.json" del /f /q "package-lock.json" 2>nul

echo  [3/5] Installing packages...
call npm install
if errorlevel 1 (
  echo.
  echo  [ERROR] npm install failed.
  echo  Most common fix:
  echo   - Node 20 LTS install karo ^(not 24^)
  echo   - Folder ko C:\Pepsi pe move karo ^(OneDrive mat rakho^)
  echo   - All Node/CMD windows band karke FIX-OFFICE.bat dobara
  echo.
  pause
  exit /b 1
)

echo  [4/5] Database module check...
call npm rebuild better-sqlite3 >nul 2>nul

echo  [5/5] Building app...
call npm run build
if errorlevel 1 (
  echo  [WARN] Build fail — DEV mode start...
  start "Pepsi Dist Dev" /D "%~dp0" /MIN cmd /c "npm run dev"
  goto WAIT_OPEN
)

echo  Starting server...
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
echo  ========================================
echo   READY — login page open ho raha hai
echo  ========================================
echo  Password: admin123
echo.
start "" http://localhost:3000/login
pause
exit /b 0

:FAIL
echo.
echo  Server start nahi hua. Node 20 LTS + C:\Pepsi path try karo.
pause
exit /b 1
