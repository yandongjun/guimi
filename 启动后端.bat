@echo off
chcp 65001 >nul
setlocal

REM ============================================================================
REM 功能：启动 Guimi 项目后端服务
REM 用法：在项目根目录直接双击本文件
REM 手动命令：
REM   cd /d E:\workspace\guimi\backend
REM   node .\server.js
REM ============================================================================

echo.
echo [Guimi] 正在启动后端服务...
cd /d "%~dp0backend"

if errorlevel 1 (
  echo [Guimi] 无法进入 backend 目录，请确认项目目录结构是否完整。
  pause
  exit /b 1
)

echo [Guimi] 当前目录：%cd%
echo [Guimi] 启动命令：node .\server.js
echo.

node .\server.js

echo.
echo [Guimi] 后端进程已退出。
pause
