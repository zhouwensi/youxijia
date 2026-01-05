@echo off
title One-Click Game Dev Platform
echo ========================================
echo   One-Click Game Dev Platform
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo   1. Visit: https://nodejs.org/
    echo   2. Download LTS version
    echo   3. Install it
    echo   4. Restart this script
    echo.
    start https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js detected!
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo Installation failed!
        pause
        exit /b 1
    )
)

echo Starting server...
echo.
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop
echo.
call npm run dev
