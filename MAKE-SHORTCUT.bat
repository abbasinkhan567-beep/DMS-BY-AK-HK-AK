@echo off
title Pepsi - Desktop Shortcut
cd /d "%~dp0"

echo.
echo  ========================================
echo   PEPSI DISTRIBUTION - DESKTOP SHORTCUT
echo  ========================================
echo.

if not exist "START.bat" (
  echo  [ERROR] START.bat not found in this folder.
  pause
  exit /b 1
)

echo  Creating desktop shortcut...

powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $sc=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Pepsi Distribution.lnk'); $sc.TargetPath='%~dp0START.bat'; $sc.WorkingDirectory='%~dp0'; $sc.Description='Pepsi Distribution Management System'; $ico='%~dp0public\icon.ico'; if(Test-Path $ico){$sc.IconLocation=$ico}; $sc.Save()"

if errorlevel 1 (
  echo  [ERROR] Could not create shortcut.
  pause
  exit /b 1
)

echo  [OK] Shortcut created on desktop!
echo  Double-click the icon to run the app.
echo.
pause