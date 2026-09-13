@echo off
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this computer.
  echo Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)

call npm start
