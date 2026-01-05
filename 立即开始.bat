@echo off
chcp 65001 >nul
title 一键游戏开发平台
color 0B

:MENU
cls
echo ========================================
echo   一键游戏开发平台 - 快速启动
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [状态] Node.js 未安装
    echo.
    echo ========================================
    echo   需要先安装 Node.js
    echo ========================================
    echo.
    echo 请选择安装方式:
    echo.
    echo [1] 打开 Node.js 官网下载页面（推荐）
    echo [2] 查看详细安装说明
    echo [3] 退出
    echo.
    set /p choice="请输入选项 (1-3): "
    
    if "%choice%"=="1" (
        start https://nodejs.org/
        echo.
        echo 已打开 Node.js 官网
        echo 请下载 LTS 版本并安装
        echo 安装完成后，请重新运行此脚本
        echo.
        pause
        goto :MENU
    )
    if "%choice%"=="2" (
        notepad 安装说明.txt
        goto :MENU
    )
    if "%choice%"=="3" (
        exit
    )
    goto :MENU
)

:: Node.js is installed
for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VER=%%i
for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VER=%%i
echo [状态] Node.js 已安装
echo       版本: %NODE_VER%
echo       npm: %NPM_VER%
echo.

:: Check dependencies
if not exist "node_modules" (
    echo [状态] 依赖未安装
    echo.
    echo ========================================
    echo   安装项目依赖
    echo ========================================
    echo.
    echo 正在安装依赖，请稍候...
    echo 这可能需要几分钟时间
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [错误] 依赖安装失败
        echo 请检查网络连接或错误信息
        pause
        exit /b 1
    )
    echo.
    echo [成功] 依赖安装完成！
    echo.
    timeout /t 2 >nul
)

:: Start server
cls
echo ========================================
echo   启动开发服务器
echo ========================================
echo.
echo 服务器地址: http://localhost:3000
echo.
echo 提示: 按 Ctrl+C 可停止服务器
echo.
echo ========================================
echo.
call npm run dev
