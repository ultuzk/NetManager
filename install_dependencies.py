#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
网络设备统一管理平台 - 环境检测与依赖安装脚本
"""

import subprocess
import sys
import os
import importlib

def check_python_version():
    """检查Python版本"""
    if sys.version_info < (3, 8):
        print("❌ Python版本要求: 3.8+")
        print(f"   当前版本: {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
        return False
    print(f"✅ Python版本: {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")
    return True

def check_package(package_name, required_version=None):
    """检查单个包是否安装"""
    try:
        module = importlib.import_module(package_name)
        version = getattr(module, '__version__', 'unknown')
        if required_version and version < required_version:
            print(f"⚠️ {package_name}版本过低: 当前 {version}, 需要 {required_version}")
            return False
        print(f"✅ {package_name} ({version})")
        return True
    except ImportError:
        print(f"❌ {package_name} 未安装")
        return False

def install_packages():
    """安装Python依赖"""
    print("\n📦 开始安装Python依赖...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Python依赖安装完成")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Python依赖安装失败: {e}")
        return False

def check_node():
    """检查Node.js是否安装"""
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"✅ Node.js {version}")
            return True
        else:
            print("❌ Node.js未安装")
            return False
    except FileNotFoundError:
        print("❌ Node.js未安装")
        return False

def install_frontend_dependencies():
    """安装前端依赖"""
    print("\n📦 开始安装前端依赖...")
    try:
        subprocess.check_call(["npm", "install"], cwd="frontend")
        print("✅ 前端依赖安装完成")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ 前端依赖安装失败: {e}")
        return False

def create_data_directory():
    """创建数据目录"""
    if not os.path.exists("data"):
        os.makedirs("data")
        print("✅ 创建数据目录")
    else:
        print("✅ 数据目录已存在")

def main():
    print("=" * 60)
    print("   网络设备统一管理平台 - 环境检测与依赖安装")
    print("=" * 60)
    
    # 检查Python版本
    if not check_python_version():
        sys.exit(1)
    
    # 检查核心依赖
    print("\n🔍 检查Python依赖...")
    packages = ["fastapi", "uvicorn", "sqlalchemy", "paramiko", "requests"]
    missing_packages = []
    
    for package in packages:
        if not check_package(package):
            missing_packages.append(package)
    
    # 安装缺失的依赖
    if missing_packages:
        print(f"\n⚠️ 检测到 {len(missing_packages)} 个缺失依赖")
        install_packages()
    
    # 检查Node.js
    print("\n🔍 检查前端环境...")
    if not check_node():
        print("⚠️ Node.js未安装，请手动安装: https://nodejs.org/")
        print("   建议安装 LTS 版本")
    
    # 安装前端依赖
    install_frontend_dependencies()
    
    # 创建数据目录
    create_data_directory()
    
    print("\n" + "=" * 60)
    print("   环境检测与依赖安装完成！")
    print("=" * 60)
    print("\n启动方式:")
    print("  1. 运行 start.bat 启动服务")
    print("  2. 访问 http://localhost:5173")

if __name__ == "__main__":
    main()
