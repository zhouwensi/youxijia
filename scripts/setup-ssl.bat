@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    游戏家 SSL 证书部署脚本
echo    支持 Cloudflare SSL 证书
echo ========================================
echo.

:: 检查是否以管理员身份运行
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] 建议以管理员身份运行此脚本
    echo.
)

:: 创建 SSL 证书目录
set SSL_DIR=%~dp0..\ssl
if not exist "%SSL_DIR%" (
    mkdir "%SSL_DIR%"
    echo [INFO] 已创建 SSL 目录: %SSL_DIR%
)

echo.
echo =========== 选择部署方式 ===========
echo.
echo [1] Cloudflare 代理模式（推荐）
echo     - 无需在服务器配置证书
echo     - Cloudflare 自动处理 HTTPS
echo     - 最简单的方式
echo.
echo [2] Cloudflare Origin 证书
echo     - 在服务器配置 HTTPS
echo     - 需要将证书文件放入 ssl 目录
echo     - 适合需要全程加密的场景
echo.
set /p choice="请选择 (1/2): "

if "%choice%"=="1" (
    call :setup_proxy_mode
) else if "%choice%"=="2" (
    call :setup_origin_cert
) else (
    echo [错误] 无效的选择
    goto :end
)

goto :end

:setup_proxy_mode
echo.
echo =========== Cloudflare 代理模式配置 ===========
echo.
echo 此模式下，您的服务器只需要运行 HTTP (端口 80)
echo Cloudflare 会自动处理 HTTPS 加密
echo.
echo 请在 Cloudflare 控制台完成以下设置：
echo.
echo 1. 登录 Cloudflare Dashboard
echo 2. 选择您的域名
echo 3. 进入 "DNS" 设置：
echo    - 确保 A 记录指向您的服务器 IP
echo    - 确保代理状态为 "已代理"（橙色云朵图标）
echo.
echo 4. 进入 "SSL/TLS" 设置：
echo    - 选择 "完全" 或 "完全（严格）" 模式
echo    - 如果您的服务器没有 SSL，选择 "灵活" 模式
echo.
echo 5. 进入 "边缘证书" 设置：
echo    - 确保 "始终使用 HTTPS" 已开启
echo    - 确保 "自动 HTTPS 重写" 已开启
echo.
echo [INFO] 代理模式不需要修改服务器配置！
echo [INFO] 您的服务器继续以 HTTP 方式运行即可。
echo.
pause
goto :eof

:setup_origin_cert
echo.
echo =========== Cloudflare Origin 证书配置 ===========
echo.
echo 请先从 Cloudflare 获取 Origin 证书：
echo.
echo 1. 登录 Cloudflare Dashboard
echo 2. 选择您的域名 ^> SSL/TLS ^> 源服务器
echo 3. 点击 "创建证书"
echo 4. 保持默认选项，点击 "创建"
echo 5. 复制证书内容保存为: ssl\cert.pem
echo 6. 复制私钥内容保存为: ssl\key.pem
echo.

set /p has_cert="您是否已将证书文件放入 ssl 目录? (y/n): "

if /i not "%has_cert%"=="y" (
    echo.
    echo [INFO] 请先获取并保存证书文件，然后重新运行此脚本
    echo [INFO] 证书文件路径：
    echo        - %SSL_DIR%\cert.pem （证书）
    echo        - %SSL_DIR%\key.pem  （私钥）
    pause
    goto :eof
)

:: 检查证书文件是否存在
if not exist "%SSL_DIR%\cert.pem" (
    echo [错误] 找不到证书文件: %SSL_DIR%\cert.pem
    pause
    goto :eof
)

if not exist "%SSL_DIR%\key.pem" (
    echo [错误] 找不到私钥文件: %SSL_DIR%\key.pem
    pause
    goto :eof
)

echo.
echo [INFO] 证书文件检测成功！
echo [INFO] 正在创建 HTTPS 服务器配置...
echo.

:: 创建 HTTPS 服务器包装脚本
call :create_https_server

echo.
echo [SUCCESS] SSL 配置完成！
echo.
echo 后续步骤：
echo 1. 确保 .env 文件中设置了 SSL_ENABLED=true
echo 2. 使用 start-ssl.bat 启动 HTTPS 服务器
echo 3. 在 Cloudflare SSL/TLS 设置中选择 "完全（严格）" 模式
echo.
pause
goto :eof

:create_https_server
:: 创建 HTTPS 服务器包装文件
(
echo const https = require^('https'^);
echo const fs = require^('fs'^);
echo const path = require^('path'^);
echo.
echo // 读取 SSL 证书
echo const sslDir = path.join^(__dirname, 'ssl'^);
echo const options = {
echo   key: fs.readFileSync^(path.join^(sslDir, 'key.pem'^)^),
echo   cert: fs.readFileSync^(path.join^(sslDir, 'cert.pem'^)^)
echo };
echo.
echo // 导入 Express 应用
echo const app = require^('./server'^);
echo.
echo // 创建 HTTPS 服务器
echo const PORT = process.env.SSL_PORT ^|^| 443;
echo const server = https.createServer^(options, app^);
echo.
echo server.listen^(PORT, ^(^) =^> {
echo   console.log^(`[HTTPS] 服务器运行在端口 ${PORT}`^);
echo   console.log^(`[HTTPS] 访问 https://localhost:${PORT}`^);
echo }^);
echo.
echo // 可选：同时启动 HTTP 服务器用于重定向
echo const http = require^('http'^);
echo const HTTP_PORT = process.env.PORT ^|^| 80;
echo.
echo const httpApp = require^('express'^)^(^);
echo httpApp.use^(^(req, res^) =^> {
echo   res.redirect^(301, `https://${req.headers.host}${req.url}`^);
echo }^);
echo.
echo http.createServer^(httpApp^).listen^(HTTP_PORT, ^(^) =^> {
echo   console.log^(`[HTTP] 重定向服务器运行在端口 ${HTTP_PORT}`^);
echo }^);
) > "%~dp0..\server-ssl.js"

echo [INFO] 已创建 server-ssl.js

:: 创建 SSL 启动脚本
(
echo @echo off
echo chcp 65001 ^>nul
echo echo 启动 HTTPS 服务器...
echo cd /d "%%~dp0"
echo set SSL_ENABLED=true
echo set SSL_PORT=443
echo set PORT=80
echo node server-ssl.js
echo pause
) > "%~dp0..\start-ssl.bat"

echo [INFO] 已创建 start-ssl.bat
goto :eof

:end
echo.
echo 脚本执行完毕！
pause
