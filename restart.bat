@echo off
chcp 65001 >nul
echo.
echo ===============================================
echo    网络设备统一管理平台 - 重启脚本
echo ===============================================
echo.

echo 🔄 正在重启服务...

:: 先停止服务
call stop.bat

:: 等待服务停止
timeout /t 2 /nobreak >nul

echo.
echo -----------------------------------------------
echo.

:: 再启动服务
call start.bat