@echo off
chcp 65001 >nul 2>&1
title AI游戏工坊 - 一键安装
color 0A

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║              🎮  AI游戏工坊 - 一键安装程序  🎮              ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

:: 获取当前脚本所在目录
cd /d "%~dp0"

echo [1/5] 正在检测 Node.js 环境...
echo.

:: 检测 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js
    echo.
    echo    请先安装 Node.js，下载地址：
    echo    https://nodejs.org/
    echo.
    echo    推荐下载 LTS 版本（长期支持版）
    echo.
    pause
    exit /b 1
)

:: 获取 Node.js 版本
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js 已安装: %NODE_VERSION%
echo.

:: 检测 npm
echo [2/5] 正在检测 npm...
echo.

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 未检测到 npm
    echo.
    echo    请重新安装 Node.js，npm 会自动附带安装
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo ✅ npm 已安装: v%NPM_VERSION%
echo.

:: 检测 package.json
echo [3/5] 正在检测项目配置...
echo.

if not exist "package.json" (
    echo ⚠️  未找到 package.json，正在创建...
    echo.
    
    :: 创建 package.json
    (
        echo {
        echo   "name": "ai-game-generator",
        echo   "version": "1.0.0",
        echo   "description": "一句话生成游戏 - AI Game Generator",
        echo   "main": "server.js",
        echo   "scripts": {
        echo     "start": "node server.js",
        echo     "dev": "node server.js"
        echo   },
        echo   "dependencies": {
        echo     "express": "^4.18.2",
        echo     "better-sqlite3": "^9.4.3",
        echo     "uuid": "^9.0.0"
        echo   },
        echo   "author": "",
        echo   "license": "MIT"
        echo }
    ) > package.json
    
    echo ✅ package.json 已创建
) else (
    echo ✅ package.json 已存在
)
echo.

:: 安装依赖
echo [4/5] 正在安装项目依赖...
echo.
echo    这可能需要几分钟时间，请耐心等待...
echo.

:: 清理之前可能损坏的安装
if exist "node_modules" (
    echo    发现已有 node_modules，正在更新...
)

:: 使用 npm install 安装依赖
call npm install --no-fund --no-audit 2>&1

if %errorlevel% neq 0 (
    echo.
    echo ❌ 依赖安装失败
    echo.
    echo    可能的原因：
    echo    1. 网络连接问题
    echo    2. npm 镜像源问题（可尝试切换淘宝镜像）
    echo.
    echo    切换淘宝镜像命令：
    echo    npm config set registry https://registry.npmmirror.com
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ 依赖安装完成
echo.

:: 检测必要文件
echo [5/5] 正在检测项目文件...
echo.

set MISSING_FILES=0

if not exist "server.js" (
    echo ❌ 缺少 server.js
    set MISSING_FILES=1
)

if not exist "public\index.html" (
    echo ❌ 缺少 public\index.html
    set MISSING_FILES=1
)

if not exist "public\css\style.css" (
    echo ❌ 缺少 public\css\style.css
    set MISSING_FILES=1
)

if not exist "public\js\app.js" (
    echo ❌ 缺少 public\js\app.js
    set MISSING_FILES=1
)

if %MISSING_FILES% equ 1 (
    echo.
    echo ⚠️  部分项目文件缺失，请检查项目完整性
    echo.
    pause
    exit /b 1
)

echo ✅ server.js
echo ✅ public\index.html
echo ✅ public\css\style.css
echo ✅ public\js\app.js
echo.

:: 创建数据目录
if not exist "data" (
    mkdir data
    echo ✅ 已创建 data 目录
    echo.
)

:: 安装完成
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                                                              ║
echo ║                    ✅ 安装完成！                             ║
echo ║                                                              ║
echo ║   请运行 start.bat 启动服务器                                ║
echo ║   或执行: npm start                                          ║
echo ║                                                              ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

pause
