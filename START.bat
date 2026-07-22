@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy RemoteSigned -File "%~dp0start-server.ps1" -Setup
pause