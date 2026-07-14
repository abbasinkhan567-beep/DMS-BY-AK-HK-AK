@echo off
title Pepsi Distribution - Manual Backup
color 0B
cd /d "%~dp0"

echo.
echo  ========================================
echo   PEPSI DISTRIBUTION - MANUAL BACKUP
echo  ========================================
echo.

if not exist "data\pepsi.db" (
  echo  [ERROR] data\pepsi.db not found.
  echo  Open the app once first so the database is created.
  echo.
  pause
  exit /b 1
)

if not exist "data\backups" mkdir "data\backups"
if not exist "%USERPROFILE%\Documents\Pepsi-Distribution-Backups" mkdir "%USERPROFILE%\Documents\Pepsi-Distribution-Backups"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set STAMP=%%I
set NAME=pepsi-backup-%STAMP%.db

copy /Y "data\pepsi.db" "data\backups\%NAME%" >nul
copy /Y "data\pepsi.db" "data\backups\pepsi-latest.db" >nul
copy /Y "data\pepsi.db" "%USERPROFILE%\Documents\Pepsi-Distribution-Backups\%NAME%" >nul
copy /Y "data\pepsi.db" "%USERPROFILE%\Documents\Pepsi-Distribution-Backups\pepsi-latest.db" >nul

echo  Backup saved:
echo    data\backups\%NAME%
echo    Documents\Pepsi-Distribution-Backups\%NAME%
echo.
echo  Tip: copy that .db file to a USB for extra safety.
echo.
pause
