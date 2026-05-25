@echo off
chcp 65001 >nul
echo.
echo ===============================================
echo    网络设备统一管理平台 - 启动脚本
echo ===============================================
echo.

:: 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python未安装，请先安装Python 3.8+
    echo    下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js未安装，请先安装Node.js
    echo    下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ 环境检查通过
echo.

:: 检查是否已启动
tasklist /fi "imagename eq python.exe" | findstr /i "uvicorn" >nul
if %errorlevel% equ 0 (
    echo ⚠️ 检测到后端服务已在运行
    echo    请先运行 stop.bat 停止服务
    pause
    exit /b 1
)

echo 🚀 启动后端服务...
start "后端服务" cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: 等待后端启动
timeout /t 3 /nobreak >nul

echo 🚀 启动前端服务...
start "前端服务" cmd /k "cd frontend && npm run dev"

echo.
echo ===============================================
echo    服务启动成功！
echo ===============================================
echo.
echo 访问地址:
echo   前端页面: http://localhost:5173
echo   后端API: http://localhost:8000
echo   API文档: http://localhost:8000/docs
echo.
echo 按任意键退出此窗口...
pause >nul