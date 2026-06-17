@echo off
chcp 65001 > nul
echo ================================
echo   隐患随手拍系统 - 启动中...
echo ================================
echo.

REM 检查 node 是否可用
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

REM 进入脚本所在目录
cd /d %~dp0

REM 检查依赖是否存在，不存在则安装
if not exist "node_modules\" (
    echo [首次运行] 正在安装依赖，请稍候...
    call npm install
    echo.
)

echo [启动] 正在启动服务...
echo.
node server.js

pause
