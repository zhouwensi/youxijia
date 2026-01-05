@echo off
chcp 65001 >nul
title 一键游戏开发平台 - 自动安装和启动
color 0A

echo ========================================
echo   一键游戏开发平台 - 自动安装和启动
echo ========================================
echo.

:: 检查 Node.js
echo [1/4] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ 错误: 未检测到 Node.js
    echo.
    echo 请先安装 Node.js:
    echo   1. 访问 https://nodejs.org/
    echo   2. 下载 LTS 版本并安装
    echo   3. 安装完成后重启此脚本
    echo.
    echo 或者运行以下命令安装（如果已安装 winget）:
    echo   winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 安装异常
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✓ Node.js 版本: %NODE_VERSION%
echo ✓ npm 版本: %NPM_VERSION%
echo.

:: 检查 node_modules
echo [2/4] 检查项目依赖...
if not exist "node_modules" (
    echo 依赖未安装，开始安装...
    echo 这可能需要几分钟，请耐心等待...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo ❌ 依赖安装失败
        echo 请检查网络连接或尝试手动运行: npm install
        pause
        exit /b 1
    )
    echo.
    echo ✓ 依赖安装完成
) else (
    echo ✓ 依赖已存在，跳过安装
)
echo.

:: 启动开发服务器
echo [3/4] 启动开发服务器...
echo.
echo ========================================
echo   服务器启动中...
echo ========================================
echo.
echo 访问地址: http://localhost:3000
echo.
echo 按 Ctrl+C 停止服务器
echo.
echo ========================================
echo.

call npm run dev

pause
