@echo off
title Pepsi Distribution - Start Online
color 0B
cd /d "%~dp0"

echo.
echo  ========================================
echo   START APP + ONLINE TUNNEL
echo  ========================================
echo.

REM Start app if not already up
curl -s -o NUL -w "%%{http_code}" http://localhost:3000 | findstr /C:"200" >NUL
if errorlevel 1 (
  echo  Starting Pepsi app...
  start "Pepsi Dist Server" /MIN cmd /c "cd /d \"%~dp0\" && npm start"
  timeout /t 8 /nobreak >nul
)

echo  Opening remote tunnel window...
start "Pepsi Tunnel" cmd /c "%~dp0scripts\start-tunnel.bat"

echo.
echo  Done. Use the HTTPS link from the tunnel window.
echo  Office staff can keep using Desktop icon / localhost.
echo.
pause
