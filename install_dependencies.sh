#!/bin/bash
# 网络设备统一管理平台 - 环境检测与依赖安装脚本 (Linux)

set -e

echo ""
echo "==============================================="
echo "    网络设备统一管理平台 - 环境检测与依赖安装"
echo "==============================================="
echo ""

# 检查是否为root用户
if [ "$(id -u)" != "0" ]; then
    echo "⚠️ 建议使用root用户运行此脚本以安装系统依赖"
    echo ""
fi

# 检查Python版本
check_python_version() {
    local version=$(python3 --version 2>&1 | awk '{print $2}')
    local major=$(echo $version | cut -d. -f1)
    local minor=$(echo $version | cut -d. -f2)
    
    if [ $major -lt 3 ] || ([ $major -eq 3 ] && [ $minor -lt 8 ]); then
        echo "❌ Python版本要求: 3.8+"
        echo "   当前版本: $version"
        return 1
    fi
    echo "✅ Python版本: $version"
    return 0
}

# 安装系统依赖
install_system_deps() {
    echo ""
    echo "📦 安装系统依赖..."
    
    # 检查是否已安装python3-pip
    if ! command -v pip3 &> /dev/null; then
        echo "   安装 python3-pip..."
        yum install -y python3-pip
    fi
    
    # 检查是否已安装nodejs
    if ! command -v node &> /dev/null; then
        echo "   安装 nodejs..."
        yum install -y nodejs npm
    fi
    
    # 安装编译依赖（用于paramiko）
    echo "   安装编译依赖..."
    yum install -y gcc python3-devel openssl-devel
    
    echo "✅ 系统依赖安装完成"
}

# 安装Python依赖
install_python_deps() {
    echo ""
    echo "📦 安装Python依赖..."
    pip3 install -r requirements.txt
    echo "✅ Python依赖安装完成"
}

# 设置npm镜像
set_npm_mirror() {
    echo "   配置npm淘宝镜像..."
    npm config set registry https://registry.npmmirror.com
    echo "✅ npm镜像配置完成"
}

# 安装前端依赖
install_frontend_deps() {
    echo ""
    echo "📦 安装前端依赖..."
    
    # 设置npm镜像
    set_npm_mirror
    
    cd frontend
    if npm install; then
        echo "✅ 前端依赖安装完成"
        cd ..
        return 0
    else
        echo "❌ npm安装失败，尝试使用yarn..."
        npm install -g yarn
        if yarn install; then
            echo "✅ 使用yarn安装前端依赖完成"
            cd ..
            return 0
        else
            echo "❌ yarn安装也失败"
            echo "💡 请检查网络连接或手动配置npm代理"
            echo "   npm config set proxy http://proxy-server:port"
            echo "   npm config set https-proxy http://proxy-server:port"
            cd ..
            return 1
        fi
    fi
}

# 创建数据目录
create_data_dir() {
    echo ""
    if [ ! -d "data" ]; then
        mkdir -p data
        echo "✅ 创建数据目录"
    else
        echo "✅ 数据目录已存在"
    fi
}

# 设置脚本权限
set_permissions() {
    echo ""
    echo "🔧 设置脚本执行权限..."
    chmod +x start.sh stop.sh restart.sh install_dependencies.sh
    echo "✅ 权限设置完成"
}

# 主函数
main() {
    # 检查Python版本
    if ! check_python_version; then
        exit 1
    fi
    
    # 安装系统依赖
    install_system_deps
    
    # 安装Python依赖
    install_python_deps
    
    # 安装前端依赖
    install_frontend_deps
    
    # 创建数据目录
    create_data_dir
    
    # 设置权限
    set_permissions
    
    echo ""
    echo "==============================================="
    echo "    环境检测与依赖安装完成！"
    echo "==============================================="
    echo ""
    echo "启动方式:"
    echo "  1. 运行 bash start.sh 启动服务"
    echo "  2. 访问 http://localhost:5173"
    echo ""
    echo "管理命令:"
    echo "  bash start.sh    - 启动服务"
    echo "  bash stop.sh     - 停止服务"
    echo "  bash restart.sh  - 重启服务"
}

main