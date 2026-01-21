@echo off
chcp 65001 >nul
echo ============================================
echo   Chrome HTTPS/HSTS 缓存清理工具
echo   目标域名: www.yijuhuayouxi.com
echo ============================================
echo.

echo [!] 请先关闭所有 Chrome 浏览器窗口！
echo.
pause

echo.
echo [1/4] 正在关闭 Chrome 进程...
taskkill /F /IM chrome.exe 2>nul
timeout /t 2 >nul

echo.
echo [2/4] 正在清理 Chrome 缓存文件...

:: Chrome 默认用户数据目录
set "CHROME_DATA=%LOCALAPPDATA%\Google\Chrome\User Data"

:: 清理缓存
if exist "%CHROME_DATA%\Default\Cache" (
    rd /s /q "%CHROME_DATA%\Default\Cache" 2>nul
    echo     - 已清理 Cache
)

if exist "%CHROME_DATA%\Default\Code Cache" (
    rd /s /q "%CHROME_DATA%\Default\Code Cache" 2>nul
    echo     - 已清理 Code Cache
)

if exist "%CHROME_DATA%\Default\GPUCache" (
    rd /s /q "%CHROME_DATA%\Default\GPUCache" 2>nul
    echo     - 已清理 GPUCache
)

:: 清理网络状态 (包含HSTS信息)
if exist "%CHROME_DATA%\Default\Network\TransportSecurity" (
    del /f /q "%CHROME_DATA%\Default\Network\TransportSecurity" 2>nul
    echo     - 已清理 TransportSecurity (HSTS)
)

if exist "%CHROME_DATA%\Default\TransportSecurity" (
    del /f /q "%CHROME_DATA%\Default\TransportSecurity" 2>nul
    echo     - 已清理 TransportSecurity (旧版HSTS)
)

:: 清理 HTTP 缓存
if exist "%CHROME_DATA%\Default\Network\Network Persistent State" (
    del /f /q "%CHROME_DATA%\Default\Network\Network Persistent State" 2>nul
    echo     - 已清理 Network Persistent State
)

echo.
echo [3/4] 正在刷新 DNS 缓存...
ipconfig /flushdns
echo     - DNS 缓存已刷新

echo.
echo [4/4] 正在清理 Windows 证书缓存...
certutil -urlcache * delete >nul 2>&1
echo     - 证书缓存已清理

echo.
echo ============================================
echo   清理完成！
echo ============================================
echo.
echo 请按以下步骤操作：
echo.
echo   1. 重新打开 Chrome
echo   2. 地址栏输入: http://www.yijuhuayouxi.com
echo      (注意是 http:// 不是 https://)
echo   3. 如果还不行，尝试用隐身模式打开
echo.
echo ============================================
echo.

set /p open_chrome="是否现在打开 Chrome? (Y/N): "
if /i "%open_chrome%"=="Y" (
    start chrome http://www.yijuhuayouxi.com
)

pause
