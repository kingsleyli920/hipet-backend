#!/bin/bash

# HiPet Agent Service 启动脚本
# 用于启动智能宠物健康管理 Agent 服务

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否在正确的目录
check_directory() {
    if [ ! -f "main.py" ]; then
        print_error "请在 agent-service 目录下运行此脚本"
        exit 1
    fi
    print_info "目录检查通过"
}

# 检查 .env 文件
check_env_file() {
    if [ ! -f ".env" ]; then
        print_error ".env 文件不存在"
        print_info "请创建 .env 文件，参考以下配置："
        echo ""
        echo "# Google Vertex AI 配置"
        echo "GOOGLE_PROJECT_ID=huolab-ai"
        echo "GOOGLE_LOCATION=us-central1"
        echo "GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json"
        echo "LLM_API_KEY=your_api_key"
        echo "LLM_MODEL=text-bison@001"
        echo ""
        exit 1
    fi
    print_info ".env 文件检查通过"
}

# 检查 Google 认证文件
check_google_credentials() {
    if [ -z "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        print_error "GOOGLE_APPLICATION_CREDENTIALS 环境变量未设置"
        exit 1
    fi
    
    if [ ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        print_error "Google 认证文件不存在: $GOOGLE_APPLICATION_CREDENTIALS"
        exit 1
    fi
    print_info "Google 认证文件检查通过: $GOOGLE_APPLICATION_CREDENTIALS"
}

# 检查 Python 依赖
check_dependencies() {
    print_info "检查 Python 依赖..."
    if ! python -c "import fastapi, vertexai, pydantic" 2>/dev/null; then
        print_warning "依赖包不完整，正在安装..."
        pip install -r requirements.txt
    fi
    print_success "依赖检查通过"
}

# 停止已运行的服务
stop_existing_service() {
    print_info "检查是否有服务在运行..."
    
    # 检查端口 8001 是否被占用
    if lsof -i :8001 >/dev/null 2>&1; then
        print_warning "端口 8001 被占用，正在停止现有服务..."
        
        # 查找并停止占用端口的进程
        PID=$(lsof -ti :8001)
        if [ ! -z "$PID" ]; then
            kill $PID 2>/dev/null || true
            sleep 2
            print_info "已停止进程 $PID"
        fi
    fi
    print_success "端口检查完成"
}

# 运行配置测试
# run_config_test() {
#     print_info "运行配置测试..."
#     if python test_config.py >/dev/null 2>&1; then
#         print_success "配置测试通过"
#     else
#         print_error "配置测试失败，请检查配置"
#         python test_config.py
#         exit 1
#     fi
# }

# 启动服务
start_service() {
    print_info "启动 HiPet Agent Service..."
    print_info "服务地址: http://localhost:8001"
    print_info "API 文档: http://localhost:8001/docs"
    print_info "健康检查: http://localhost:8001/health"
    echo ""
    
    # 启动服务
    python main.py
}

# 主函数
main() {
    echo "=========================================="
    echo "    HiPet Agent Service 启动脚本"
    echo "=========================================="
    echo ""
    
    # 设置环境变量
    export GOOGLE_APPLICATION_CREDENTIALS="/Users/kingsley/Downloads/huolab-ai-aa17c2427b35.json"
    
    # 执行检查步骤
    check_directory
    check_env_file
    check_google_credentials
    check_dependencies
    stop_existing_service
    # run_config_test
    
    echo ""
    print_success "所有检查通过，准备启动服务..."
    echo ""
    
    # 启动服务
    start_service
}

# 捕获中断信号
trap 'echo ""; print_info "服务已停止"; exit 0' INT TERM

# 运行主函数
main "$@"
