@echo off
title Pepsi - Make Office Folder
color 0B
cd /d "%~dp0"

echo.
echo  ========================================
echo   MAKE OFFICE PACKAGE
echo  ========================================
echo  Creates: C:\Pepsi-Office
echo  Office user only needs START.bat
echo.

node -v >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js required on this PC first.
  start https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo  Installing packages on Developer...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)

echo  Building app for Office...
call npm run build
if errorlevel 1 (
  echo  [ERROR] Build failed — Office package not created.
  pause
  exit /b 1
)

set DEST=C:\Pepsi-Office
if not exist "%DEST%" mkdir "%DEST%"

echo  Copying files to %DEST% ...
REM Fresh copy of app (keep existing Office data if any)
if exist "%DEST%\data\pepsi.db" (
  if not exist "%TEMP%\pepsi-office-db-keep" mkdir "%TEMP%\pepsi-office-db-keep"
  copy /Y "%DEST%\data\pepsi.db" "%TEMP%\pepsi-office-db-keep\pepsi.db" >nul
)

robocopy "%CD%" "%DEST%" /E /XD node_modules .git .pepsi-cloud-sync data\backups .cursor /XF PUBLISH.bat MAKE-OFFICE.bat START-HERE.txt /NFL /NDL /NJH /NJS /nc /ns /np
if %ERRORLEVEL% GEQ 8 (
  echo  [ERROR] Copy failed.
  pause
  exit /b 1
)

REM Ensure .next is present (built above)
if not exist "%DEST%\.next\BUILD_ID" (
  echo  [ERROR] Build output missing in Office folder.
  pause
  exit /b 1
)

if not exist "%DEST%\data" mkdir "%DEST%\data"
if exist "%TEMP%\pepsi-office-db-keep\pepsi.db" (
  copy /Y "%TEMP%\pepsi-office-db-keep\pepsi.db" "%DEST%\data\pepsi.db" >nul
)

(
echo PEPSI OFFICE PC
echo ================
echo.
echo 1^) Install Node.js 22+ from https://nodejs.org
echo 2^) Double-click START.bat
echo 3^) Login: admin123
echo 4^) Settings ^(password settings123^) -^> Sync
echo    PC name: Office
echo    Paste GitHub token -^> Save -^> Sync Now
echo 5^) New software: Settings -^> Updates -^> Apply
echo.
echo Do NOT use PUBLISH here. That is only on Developer PC.
) > "%DEST%\README-OFFICE.txt"

REM Pre-generate auth secret for persistent sessions
echo  Generating auth secret...
powershell -NoProfile -Command "$s=-join ((65..90)+(97..122)+(48..57)|Get-Random -Count 48|%%{[char]$_}); $s|Out-File '%DEST%\data\.auth-secret' -Encoding ascii"

REM Setup git repo so Updates and Sync work out of the box
echo  Setting up git repo...
cd /d "%DEST%"
git init -b main >nul 2>nul
git config user.email "pepsi@local"
git config user.name "Pepsi Distribution"
git add -A >nul 2>nul
git commit -m "Office setup" >nul 2>nul
git remote add origin https://github.com/abbasinkhan567-beep/DMS-BY-AK-HK-AK.git >nul 2>nul
echo  .setup-done > "%DEST%\.setup-done" 2>nul
cd /d "%~dp0"

REM Desktop shortcut
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $sc=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Pepsi Distribution.lnk'); $sc.TargetPath='powershell.exe'; $sc.Arguments='-WindowStyle Hidden -ExecutionPolicy RemoteSigned -File """%DEST%\start-server.ps1"""'; $sc.WorkingDirectory='%DEST%'; $sc.Description='Pepsi Distribution Management System'; $ico='%DEST%\public\icon.ico'; if(Test-Path $ico){$sc.IconLocation=$ico}; $sc.Save()"

REM Office should not ship developer publish tooling
if exist "%DEST%\PUBLISH.bat" del /f /q "%DEST%\PUBLISH.bat"
if exist "%DEST%\MAKE-OFFICE.bat" del /f /q "%DEST%\MAKE-OFFICE.bat"
if exist "%DEST%\START-HERE.txt" del /f /q "%DEST%\START-HERE.txt"

echo.
echo  ========================================
echo   DONE: C:\Pepsi-Office
echo  ========================================
echo  Shortcut created on desktop!
echo  Double-click to run app (first run shows setup).
echo.
pause
