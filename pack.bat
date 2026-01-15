@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: 获取当前目录名作为项目名
for %%I in ("%~dp0.") do set "PROJECT_NAME=%%~nxI"

:: 获取时间戳 (格式: YYYYMMDDHHMMSS)
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "TIMESTAMP=%dt:~0,14%"

:: 备份目录
set "BAK_DIR=%~dp0bak"

:: 如果bak目录不存在则创建
if not exist "%BAK_DIR%" (
    mkdir "%BAK_DIR%"
    echo 已创建备份目录: %BAK_DIR%
)

:: 压缩文件名（放到bak目录）
set "ZIP_NAME=%BAK_DIR%\%PROJECT_NAME%_%TIMESTAMP%.zip"

echo ========================================
echo   项目打包工具
echo ========================================
echo.
echo 项目名称: %PROJECT_NAME%
echo 压缩文件: %ZIP_NAME%
echo.

:: 创建排除列表文件
echo node_modules> "%TEMP%\7z_exclude.txt"
echo .git>> "%TEMP%\7z_exclude.txt"
echo *.zip>> "%TEMP%\7z_exclude.txt"
echo data>> "%TEMP%\7z_exclude.txt"
echo *.db>> "%TEMP%\7z_exclude.txt"
echo *.db-journal>> "%TEMP%\7z_exclude.txt"
echo bak>> "%TEMP%\7z_exclude.txt"
echo public\g>> "%TEMP%\7z_exclude.txt"

:: 检查是否有 7z
where 7z >nul 2>&1
if %errorlevel%==0 (
    echo 正在使用 7-Zip 压缩...
    7z a -tzip "%ZIP_NAME%" * -r -x@"%TEMP%\7z_exclude.txt"
    goto :done
)

:: 检查是否有 7z 在常见路径
if exist "C:\Program Files\7-Zip\7z.exe" (
    echo 正在使用 7-Zip 压缩...
    "C:\Program Files\7-Zip\7z.exe" a -tzip "%ZIP_NAME%" * -r -x@"%TEMP%\7z_exclude.txt"
    goto :done
)

:: 使用 PowerShell 压缩 (Windows 自带)
echo 正在使用 PowerShell 压缩...
powershell -Command ^
    "$source = '%~dp0'; " ^
    "$dest = '%ZIP_NAME%'; " ^
    "$exclude = @('node_modules', '.git', 'data', '*.zip', '*.db', '*.db-journal', 'bak'); " ^
    "$files = Get-ChildItem -Path $source -Exclude $exclude | Where-Object { $_.FullName -notlike '*\public\g\*' }; " ^
    "Compress-Archive -Path $files.FullName -DestinationPath $dest -Force"

:done
:: 删除临时文件
if exist "%TEMP%\7z_exclude.txt" del "%TEMP%\7z_exclude.txt"

echo.
if exist "%ZIP_NAME%" (
    echo 压缩完成!
    echo 文件: %ZIP_NAME%
    for %%A in ("%ZIP_NAME%") do echo 大小: %%~zA bytes
) else (
    echo 压缩失败!
)
echo.
pause