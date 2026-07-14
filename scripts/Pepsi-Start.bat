@echo off
REM Desktop shortcut entry — robust start for Home + Office
cd /d "%~dp0.."
title Pepsi Distribution

powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if %errorlevel%==0 (
  start "" http://localhost:3000/login
  exit /b 0
)

if not exist "node_modules\" (
  echo Installing packages... please wait
  call npm install
  if errorlevel 1 (
    echo Install failed. Run FIX-OFFICE.bat in this folder.
    pause
    exit /b 1
  )
)

if not exist ".next\BUILD_ID" (
  echo Building... please wait
  call npm run build
  if errorlevel 1 (
    echo Build failed — starting DEV mode...
    start "Pepsi Dist Dev" /D "%CD%" /MIN cmd /c "npm run dev"
    goto WAIT
  )
)

echo Starting server...
start "Pepsi Dist Server" /D "%CD%" /MIN cmd /c "npm start"

:WAIT
echo Waiting for app...
set /a tries=0
:LOOP
set /a tries+=1
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if %errorlevel%==0 (
  start "" http://localhost:3000/login
  exit /b 0
)
if %tries% Geq 20 (
  echo Server start failed. Double-click FIX-OFFICE.bat in the project folder.
  pause
  exit /b 1
)
goto LOOP
