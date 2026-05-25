@echo off
chcp 65001 >nul
echo.
echo ===============================================
echo    网络设备统一管理平台 - 停止脚本
echo ===============================================
echo.

echo ⏹️ 正在停止服务...

:: 停止后端服务 (uvicorn)
tasklist /fi "imagename eq python.exe" | findstr /i "uvicorn" >nul
if %errorlevel% equ 0 (
    taskkill /f /im python.exe /fi "windowtitle eq 后端服务" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ 后端服务已停止
    ) else (
        :: 如果窗口标题匹配失败，尝试终止所有uvicorn进程
        for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" ^| findstr uvicorn') do (
            taskkill /f /pid %%a >nul 2>&1
        )
        echo ✅ 后端服务已停止
    )
) else (
    echo ℹ️ 后端服务未运行
)

:: 停止前端服务 (npm)
tasklist /fi "imagename eq node.exe" | findstr /i "npm" >nul
if %errorlevel% equ 0 (
    taskkill /f /im node.exe /fi "windowtitle eq 前端服务" >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ 前端服务已停止
    ) else (
        :: 如果窗口标题匹配失败，尝试终止所有相关node进程
        for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" ^| findstr node') do (
            taskkill /f /pid %%a >nul 2>&1
        )
        echo ✅ 前端服务已停止
    )
) else (
    echo ℹ️ 前端服务未运行
)

echo.
echo ===============================================
echo    服务已全部停止！
echo ===============================================
echo.
echo 按任意键退出...
pause >nul