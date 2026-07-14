@echo off
REM Improved start - used by desktop shortcut
cd /d "%~dp0.."
title Pepsi Distribution

REM If already up, only open browser
curl -s -o NUL -w "%%{http_code}" http://localhost:3000 | findstr /C:"200" >NUL
if %errorlevel%==0 (
  start "" http://localhost:3000
  exit /b 0
)

if not exist "node_modules" (
  echo Installing... please wait
  call npm install
)

if not exist ".next\BUILD_ID" (
  echo Building app... please wait
  call npm run build
)

echo Starting server...
start "Pepsi Dist Server" /MIN cmd /c "cd /d \"%~dp0..\" && npm start"
timeout /t 5 /nobreak >nul
start "" http://localhost:3000
