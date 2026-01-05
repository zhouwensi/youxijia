@echo off
chcp 65001 >nul
echo ========================================
echo   One-Click Game Dev - Setup Script
echo ========================================
echo.

echo Checking Node.js...
where node >nul 2>&1
if %errorlevel% == 0 (
    node --version
    echo Node.js is installed.
    set NODE_OK=1
) else (
    echo Node.js is NOT installed.
    set NODE_OK=0
)

echo.
echo Checking npm...
where npm >nul 2>&1
if %errorlevel% == 0 (
    npm --version
    echo npm is installed.
    set NPM_OK=1
) else (
    echo npm is NOT installed.
    set NPM_OK=0
)

echo.

if %NODE_OK%==1 if %NPM_OK%==1 (
    echo Environment OK! Installing dependencies...
    echo.
    npm install
    if %errorlevel% == 0 (
        echo.
        echo ========================================
        echo   Setup Complete!
        echo ========================================
        echo.
        echo Run: npm run dev
        echo Then visit: http://localhost:3000
    ) else (
        echo.
        echo Installation failed. Please check errors above.
    )
) else (
    echo ========================================
    echo   Node.js Required
    echo ========================================
    echo.
    echo Please install Node.js:
    echo 1. Visit: https://nodejs.org/
    echo 2. Download LTS version
    echo 3. Run installer
    echo 4. Restart terminal and run this script again
    echo.
)

echo.
pause
