@echo off
chcp 65001 >nul
title One-Click Game Dev - Complete Installation
color 0B

echo ========================================
echo   Complete Installation Script
echo ========================================
echo.

:: Step 1: Check Node.js
echo [Step 1/3] Checking Node.js...
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do echo Node.js: %%i
    for /f "tokens=*" %%i in ('npm --version') do echo npm: %%i
    echo Node.js is installed.
    goto :install_deps
)

echo Node.js is NOT installed.
echo.
echo Attempting to install Node.js...
echo This requires administrator privileges.
echo.

:: Try to run PowerShell script to install Node.js
powershell -ExecutionPolicy Bypass -File "%~dp0auto-install-nodejs.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Automatic installation failed or requires manual approval.
    echo.
    echo Please install Node.js manually:
    echo   1. Visit: https://nodejs.org/
    echo   2. Download LTS version
    echo   3. Run installer
    echo   4. Restart terminal and run this script again
    echo.
    pause
    exit /b 1
)

:: Refresh PATH (may not work until terminal restart)
echo.
echo Please RESTART this terminal/script after Node.js installation.
echo.
pause
exit /b 0

:install_deps
echo.
echo [Step 2/3] Installing project dependencies...
if not exist "node_modules" (
    echo This may take a few minutes...
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo Dependency installation failed!
        echo Please check the error messages above.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
) else (
    echo Dependencies already installed. Skipping...
)
echo.

:start_server
echo [Step 3/3] Starting development server...
echo.
echo ========================================
echo   Server Starting...
echo ========================================
echo.
echo Access at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

call npm run dev

pause
