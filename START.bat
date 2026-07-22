@echo off
cd /d "%~dp0"

node -v >nul 2>nul || start https://nodejs.org & exit /b 1

if not exist "node_modules\" (
  start /B /W "" cmd /c "npm install"
)
if not exist ".next\BUILD_ID" (
  start /B /W "" cmd /c "npm run build"
)

REM Start server completely hidden (no taskbar, no window)
start /B "" wscript.exe "%~dp0start-server.vbs"

REM Open browser after a moment
timeout /t 5 /nobreak >nul 2>nul
start "" http://localhost:3000/login

exit /b 0