@echo off
title Pepsi - Publish to GitHub
color 0A
cd /d "%~dp0"

echo.
echo  ========================================
echo   PUBLISH (Developer only)
echo  ========================================
echo  Pushes code to GitHub.
echo  Office: Settings -^> Updates -^> Apply
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Install Git from https://git-scm.com
  pause
  exit /b 1
)

if not exist ".git" (
  git init
  git add .
  git -c user.email="abbasinkhan567@gmail.com" -c user.name="Abbasin Khan Bazai" commit -m "Initial Pepsi Distribution"
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/abbasinkhan567-beep/DMS-BY-AK-HK-AK.git
  git branch -M main
)

set /p MSG="Update message (optional): "
if "%MSG%"=="" set MSG=Update %DATE% %TIME%

powershell -NoProfile -Command ^
  "$v = Get-Content version.json -Raw | ConvertFrom-Json; $parts = $v.version.Split('.'); $parts[2] = [int]$parts[2] + 1; $v.version = $parts -join '.'; $v.updatedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm'); $v | ConvertTo-Json | Set-Content version.json -Encoding UTF8"

git add -A
git status
git -c user.email="abbasinkhan567@gmail.com" -c user.name="Abbasin Khan Bazai" commit -m "%MSG%"
if errorlevel 1 (
  echo  Nothing new to commit.
)

git push origin main
if errorlevel 1 (
  echo  [ERROR] Push failed — check GitHub login.
  pause
  exit /b 1
)

echo.
echo  Published. Office: Updates -^> Check / Apply
echo.
pause
