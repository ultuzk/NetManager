#!/bin/bash
# 网络设备统一管理平台 - 停止脚本 (Linux)

echo ""
echo "==============================================="
echo "    网络设备统一管理平台 - 停止脚本"
echo "==============================================="
echo ""

echo "⏹️ 正在停止服务..."

# 停止后端服务 (uvicorn) — 精确匹配项目路径
if pgrep -f "uvicorn.*backend.main" > /dev/null 2>&1; then
    pkill -f "uvicorn.*backend.main"
    echo "✅ 后端服务已停止"
else
    echo "ℹ️ 后端服务未运行"
fi

# 停止前端服务 (vite) — 精确匹配项目路径
if pgrep -f "vite.*frontend" > /dev/null 2>&1; then
    pkill -f "vite.*frontend"
    echo "✅ 前端服务已停止"
else
    echo "ℹ️ 前端服务未运行"
fi

echo ""
echo "==============================================="
echo "    服务已全部停止！"
echo "==============================================="
echo ""
