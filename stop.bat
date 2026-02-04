@echo off
chcp 65001 >nul 2>&1
title JustOneWord - 停止服务
color 0C

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║              🎮  JustOneWord - 停止服务  🎮                  ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: 设置端口号
set PORT=80

echo 正在查找运行中的服务...
echo.

:: 查找占用端口的进程
set PID_FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set PID=%%a
    set PID_FOUND=1
)

if %PID_FOUND% equ 0 (
    echo ℹ️  未发现运行中的服务（端口 %PORT% 未被占用）
    echo.
    pause
    exit /b 0
)

echo 发现服务进程 (PID: %PID%)
echo.

:: 获取进程名称
for /f "tokens=1" %%b in ('tasklist /fi "PID eq %PID%" /fo csv /nh 2^>nul') do (
    set PROC_NAME=%%b
)

echo 进程名称: %PROC_NAME%
echo.

:: 关闭进程
echo 正在停止服务...
taskkill /PID %PID% /F >nul 2>&1

if %errorlevel% equ 0 (
    echo.
    echo ✅ 服务已停止
) else (
    echo.
    echo ❌ 停止服务失败，可能需要管理员权限
)

echo.
pause
