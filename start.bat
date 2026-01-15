@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title AI游戏工坊 - 启动器
color 0B

:: 获取当前脚本所在目录
cd /d "%~dp0"

echo.
echo ================================================================
echo                  AI游戏工坊 - 一键启动
echo ================================================================
echo.

:: 设置端口号
set PORT=80

:: 检测 Node.js
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] 未检测到 Node.js，请先运行 install.bat 安装
    echo.
    pause
    exit /b 1
)

:: 检测依赖
if not exist "node_modules" (
    echo [ERROR] 未安装依赖，请先运行 install.bat
    echo.
    pause
    exit /b 1
)

:: 检测 server.js
if not exist "server.js" (
    echo [ERROR] 未找到 server.js 文件
    echo.
    pause
    exit /b 1
)

echo [1/3] 正在检测端口 %PORT% 占用情况...
echo.

:: 查找占用端口的进程
set PID_FOUND=0
set PID=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set PID=%%a
    set PID_FOUND=1
)

if !PID_FOUND! equ 1 (
    if !PID! neq 0 (
        echo [WARN] 检测到端口 %PORT% 已被占用 PID: !PID!
        echo.
        
        echo [2/3] 正在关闭之前的服务...
        
        :: 强制关闭进程
        taskkill /PID !PID! /F >nul 2>&1
        
        :: 等待端口释放
        echo       等待端口释放...
        timeout /t 2 /nobreak >nul
        
        :: 再次检查端口是否释放
        set STILL_USED=0
        for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
            set STILL_USED=1
        )
        
        if !STILL_USED! equ 1 (
            echo.
            echo [ERROR] 无法关闭进程，请以管理员身份运行此脚本
            echo         右键点击 start.bat 选择"以管理员身份运行"
            echo.
            pause
            exit /b 1
        ) else (
            echo [OK] 已关闭之前的服务
            echo.
        )
    )
) else (
    echo [OK] 端口 %PORT% 可用
    echo.
    echo [2/3] 跳过 - 无需关闭旧服务
    echo.
)

echo [3/4] 正在混淆前端代码...
echo.

:: 执行代码混淆构建
set NODE_ENV=production
node build.js
if !errorlevel! neq 0 (
    echo.
    echo [WARN] 代码混淆过程出现问题，但服务器仍将启动
    echo.
)

echo.
echo [4/4] 正在启动服务器...
echo.

:: 显示启动信息
echo ================================================================
echo   服务器启动中...
echo   访问地址: http://localhost:%PORT%
echo   按 Ctrl+C 可停止服务器
echo ================================================================
echo.

:: 尝试自动打开浏览器（延迟2秒后）
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%"

:: 启动服务器（前台运行，显示日志）
node server.js

:: 如果服务器退出，显示提示
echo.
echo ================================================================
echo   服务器已停止运行
echo ================================================================
echo.
pause