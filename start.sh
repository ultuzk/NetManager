#!/bin/bash
# 网络设备统一管理平台 - 启动脚本 (Linux)

set -e

echo ""
echo "==============================================="
echo "    网络设备统一管理平台 - 启动脚本"
echo "==============================================="
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3未安装，请先安装Python 3.8+"
    echo "   安装命令: sudo yum install python3 python3-pip"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js"
    echo "   安装命令: sudo yum install nodejs npm"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

# 检查是否已启动
if pgrep -f "uvicorn" &> /dev/null; then
    echo "⚠️ 检测到后端服务已在运行"
    echo "   请先运行 stop.sh 停止服务"
    exit 1
fi

echo "🚀 启动后端服务..."
nohup python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
echo "✅ 后端服务已启动 (PID: $!)"

# 等待后端启动
sleep 3

echo "🚀 启动前端服务..."
cd frontend
nohup npm run dev > ../frontend.log 2>&1 &
echo "✅ 前端服务已启动 (PID: $!)"
cd ..

echo ""
echo "==============================================="
echo "    服务启动成功！"
echo "==============================================="
echo ""
echo "访问地址:"
echo "   前端页面: http://localhost:5173"
echo "   后端API: http://localhost:8000"
echo "   API文档: http://localhost:8000/docs"
echo ""
echo "查看日志:"
echo "   后端日志: tail -f backend.log"
echo "   前端日志: tail -f frontend.log"
echo ""