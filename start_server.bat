@echo off
title PolyGame Local Server
echo ===================================================
echo   PolyGame Local Development Server Starter
echo ===================================================
echo.
echo Launching local server at http://localhost:8080...
echo.

:: Launch default browser to the local game page after 1 second delay
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:8080/"

:: Try py command first (modern Windows Python launcher)
py -m http.server 8080
if %errorlevel% equ 0 goto success

:: Try standard python command
python -m http.server 8080
if %errorlevel% equ 0 goto success

:: Try Node npx (if node is installed)
npx http-server -p 8080
if %errorlevel% equ 0 goto success

echo.
echo [ERROR] No local server environment (Python or Node.js) could be started.
echo Please install Python from https://python.org/
echo.
pause
exit

:success
echo Server stopped.
pause
