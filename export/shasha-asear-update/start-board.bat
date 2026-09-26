@echo off
cd /d "%~dp0"
if exist "%~dp0relay.json" (
  start "Shasha relay" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0relay-publish.ps1"
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-board.ps1"
pause
