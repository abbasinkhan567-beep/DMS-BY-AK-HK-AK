@echo off
title Publish Update to Office PCs
color 0A
cd /d "%~dp0"

echo.
echo  ========================================
echo   PUBLISH UPDATE (Developer PC)
echo  ========================================
echo.
echo  This will push your changes to GitHub.
echo  Office PCs can pull them via Settings -^> Check Updates.
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Git is not installed. Install from https://git-scm.com
  pause
  exit /b 1
)

if not exist ".git" (
  echo  Git init...
  git init
  git add .
  git commit -m "Initial Pepsi Distribution"
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo.
  echo  GitHub remote is not set yet.
  echo  1^) Create a new private repo on GitHub: pepsi-distribution
  echo  2^) Then run these commands ^(use your own URL^):
  echo.
  echo     git remote add origin https://github.com/YOUR_USER/pepsi-distribution.git
  echo     git branch -M main
  echo     git push -u origin main
  echo.
  echo  Then run PUBLISH-UPDATE.bat again.
  pause
  exit /b 1
)

set /p MSG="Update message (optional): "
if "%MSG%"=="" set MSG=Update %DATE% %TIME%

REM bump patch version lightly via powershell
powershell -NoProfile -Command ^
  "$v = Get-Content version.json -Raw | ConvertFrom-Json; $parts = $v.version.Split('.'); $parts[2] = [int]$parts[2] + 1; $v.version = $parts -join '.'; $v.updatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm'); $v | ConvertTo-Json | Set-Content version.json -Encoding UTF8"

git add -A
git status
git commit -m "%MSG%"
if errorlevel 1 (
  echo  Nothing to commit / already committed.
)

git push origin main
if errorlevel 1 (
  echo  [ERROR] Push failed. Check GitHub login / remote.
  pause
  exit /b 1
)

echo.
echo  ========================================
echo   UPDATE PUBLISHED
echo  ========================================
echo  On office PC: Settings -^> Updates -^> Check Updates
echo.
pause
