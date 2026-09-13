@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
echo (Setup script exited. This window will stay open until you close it.)
pause >nul
