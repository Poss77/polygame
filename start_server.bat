@echo off
title PolyGame Local Server
echo ===================================================
echo   PolyGame Local Development Server Starter
echo ===================================================
echo.
echo Launching local server at http://localhost:8080...
echo.

:: Open default browser to the deployer page
start "" "http://localhost:8080/deployer.html"

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
echo Please deploy your contracts using Remix IDE at https://remix.ethereum.org/
echo.
pause
exit

:success
echo Server stopped.
pause
