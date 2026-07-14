@echo off
title Pepsi Distribution - Online Tunnel
color 0B
cd /d "%~dp0.."

echo.
echo  ========================================
echo   PEPSI - REMOTE ACCESS (Cloudflare)
echo  ========================================
echo.
echo  1) Keep the Pepsi app running first
echo     (Desktop icon or: npm start)
echo  2) This window will show an HTTPS link
echo  3) Send that link to home/office login
echo.
echo  Both use the SAME data on this PC.
echo.

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo  [INFO] cloudflared not found — downloading portable copy...
  if not exist "scripts\bin" mkdir "scripts\bin"
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$out='%~dp0bin\cloudflared.exe'; if (-not (Test-Path $out)) { Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $out -UseBasicParsing }; if (-not (Test-Path $out)) { exit 1 }"
  if errorlevel 1 (
    echo  [ERROR] Download failed.
    echo  Install manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
    echo  Or place cloudflared.exe in scripts\bin\
    pause
    exit /b 1
  )
  set "CF=%~dp0bin\cloudflared.exe"
) else (
  set "CF=cloudflared"
)

if exist "%~dp0bin\cloudflared.exe" set "CF=%~dp0bin\cloudflared.exe"

echo  Starting tunnel to http://localhost:3000 ...
echo  Look for a line like: https://xxxx.trycloudflare.com
echo.
echo  Press Ctrl+C to stop the tunnel.
echo.

"%CF%" tunnel --url http://localhost:3000

pause
