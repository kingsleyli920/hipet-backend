#!/bin/bash

# HiPet Backend Service Deployment Script
# 用于在 EC2 上部署 Backend Service

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_DIR="$HOME/workspace/hipet-backend"
SERVICE_DIR="$PROJECT_DIR/backend-service"
TMUX_SESSION="hipet"
TMUX_WINDOW="backend"
SERVICE_PORT=8000

# MQTT 配置（用于设备通信）
MQTT_PORT=1883
MQTT_WINDOW="mqtt"

# 打印函数
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

# 检查项目目录
check_project_dir() {
    if [ ! -d "$PROJECT_DIR" ]; then
        print_error "项目目录不存在: $PROJECT_DIR"
        print_info "请先克隆项目: git clone git@github.com-hipet-backend:kingsleyli920/hipet-backend.git"
        exit 1
    fi
    
    if [ ! -d "$SERVICE_DIR" ]; then
        print_error "Backend service 目录不存在: $SERVICE_DIR"
        exit 1
    fi
    
    print_success "目录检查通过"
}

# 创建或连接到 tmux session
setup_tmux() {
    print_info "设置 Tmux 环境..."
    
    # 检查 tmux session 是否存在
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        print_info "Tmux session '$TMUX_SESSION' 已存在"
        
        # 检查 window 是否存在
        if tmux list-windows -t "$TMUX_SESSION" -F "#{window_name}" | grep -q "^${TMUX_WINDOW}$"; then
            print_info "Window '$TMUX_WINDOW' 已存在，将重新使用"
            # 清空 window 内容
            tmux send-keys -t "${TMUX_SESSION}:${TMUX_WINDOW}" C-c C-l || true
        else
            print_info "创建新 window: $TMUX_WINDOW"
            tmux new-window -t "$TMUX_SESSION" -n "$TMUX_WINDOW" -c "$SERVICE_DIR"
        fi
    else
        print_info "创建新的 tmux session: $TMUX_SESSION"
        tmux new-session -d -s "$TMUX_SESSION" -n "$TMUX_WINDOW" -c "$SERVICE_DIR"
    fi
    
    print_success "Tmux 环境就绪"
}

# 拉取最新代码
pull_code() {
    print_info "拉取最新代码..."
    
    cd "$PROJECT_DIR"
    
    # 检查是否有未提交的更改
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_warning "检测到未提交的更改，将 stash 它们"
        git stash
    fi
    
    # 拉取最新代码
    git pull origin main || {
        print_error "代码拉取失败"
        exit 1
    }
    
    print_success "代码已更新"
}

# 停止占用端口的进程
kill_port() {
    print_info "检查端口 $SERVICE_PORT 占用情况..."
    
    # 检查端口是否被占用
    if command -v lsof >/dev/null 2>&1; then
        PID=$(lsof -ti :$SERVICE_PORT 2>/dev/null || true)
        if [ ! -z "$PID" ]; then
            print_warning "发现进程 $PID 占用端口 $SERVICE_PORT，正在停止..."
            kill -TERM $PID 2>/dev/null || true
            sleep 2
            
            # 如果还在运行，强制杀死
            if kill -0 $PID 2>/dev/null; then
                print_warning "进程未正常退出，强制停止..."
                kill -9 $PID 2>/dev/null || true
                sleep 1
            fi
            print_success "端口 $SERVICE_PORT 已释放"
        else
            print_info "端口 $SERVICE_PORT 未被占用"
        fi
    elif command -v ss >/dev/null 2>&1; then
        PID=$(ss -tlnp | grep ":$SERVICE_PORT " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
        if [ ! -z "$PID" ]; then
            print_warning "发现进程 $PID 占用端口 $SERVICE_PORT，正在停止..."
            kill -TERM $PID 2>/dev/null || true
            sleep 2
            if kill -0 $PID 2>/dev/null; then
                kill -9 $PID 2>/dev/null || true
                sleep 1
            fi
            print_success "端口 $SERVICE_PORT 已释放"
        else
            print_info "端口 $SERVICE_PORT 未被占用"
        fi
    else
        print_warning "无法检查端口占用（lsof 和 ss 都不可用），跳过此步骤"
    fi
}

# 检查并安装依赖
install_dependencies() {
    print_info "安装/更新依赖..."
    
    cd "$SERVICE_DIR"
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        print_warning ".env 文件不存在"
        if [ -f "env.example" ]; then
            print_info "从 env.example 创建 .env 文件"
            cp env.example .env
            print_warning "请更新 .env 文件中的配置"
        else
            print_error "env.example 文件不存在，请手动创建 .env 文件"
            exit 1
        fi
    fi
    
    # 检查 Bun 是否安装
    if ! command -v bun >/dev/null 2>&1; then
        print_error "Bun 未安装，请先安装 Bun"
        exit 1
    fi
    
    # 安装依赖
    print_info "运行 bun install..."
    bun install
    
    # 生成 Prisma Client
    print_info "生成 Prisma Client..."
    bunx prisma generate
    
    print_success "依赖安装完成"
}

# 启动 / 检查 MQTT Broker（mosquitto）
start_mqtt_broker() {
    print_info "检查 / 启动 MQTT Broker (mosquitto)..."

    # 检查 mosquitto 是否安装
    if ! command -v mosquitto >/dev/null 2>&1; then
        print_warning "mosquitto 未安装，跳过 MQTT Broker 启动（请先在服务器上安装 mosquitto）"
        print_warning "例如: sudo yum install -y mosquitto 或 sudo apt-get install -y mosquitto"
        return
    fi

    # 检查 MQTT 端口是否已被占用（说明已经有 broker 在跑）
    local MQTT_PID=""
    if command -v lsof >/dev/null 2>&1; then
        MQTT_PID=$(lsof -ti :$MQTT_PORT 2>/dev/null || true)
    elif command -v ss >/dev/null 2>&1; then
        MQTT_PID=$(ss -tlnp | grep ":$MQTT_PORT " | grep -oP 'pid=\K[0-9]+' | head -1 || true)
    fi

    if [ ! -z "$MQTT_PID" ]; then
        print_info "检测到已有进程 ($MQTT_PID) 正在监听 MQTT 端口 $MQTT_PORT，认为 Broker 已经运行，跳过启动。"
        return
    fi

    # 在 tmux 中启动一个单独的 MQTT window，运行 mosquitto
    local WINDOW_NAME="$MQTT_WINDOW"
    if tmux list-windows -t "$TMUX_SESSION" -F "#{window_name}" | grep -q "^${WINDOW_NAME}$"; then
        print_info "复用已存在的 Tmux window '$WINDOW_NAME' 启动 MQTT Broker"
        tmux send-keys -t "${TMUX_SESSION}:${WINDOW_NAME}" C-c C-l || true
    else
        print_info "创建新的 Tmux window 用于 MQTT: $WINDOW_NAME"
        tmux new-window -t "$TMUX_SESSION" -n "$WINDOW_NAME" -c "$SERVICE_DIR"
    fi

    tmux send-keys -t "${TMUX_SESSION}:${WINDOW_NAME}" "mosquitto -p $MQTT_PORT -v" C-m
    print_success "MQTT Broker 启动命令已发送到 tmux（window: $WINDOW_NAME, 端口: $MQTT_PORT）"
    print_info "如需查看 Broker 日志: tmux attach -t $TMUX_SESSION -c $MQTT_WINDOW"
}

# 启动服务
start_service() {
    print_info "启动 Backend Service..."
    
    cd "$SERVICE_DIR"
    
    # 在 tmux window 中启动服务
    tmux send-keys -t "${TMUX_SESSION}:${TMUX_WINDOW}" "cd $SERVICE_DIR" C-m
    tmux send-keys -t "${TMUX_SESSION}:${TMUX_WINDOW}" "bun run start" C-m
    
    print_success "服务启动命令已发送到 tmux"
    print_info "使用 'tmux attach -t $TMUX_SESSION' 查看服务日志"
    print_info "服务地址: http://localhost:$SERVICE_PORT"
    print_info "健康检查: http://localhost:$SERVICE_PORT/health/"
}

# 主函数
main() {
    echo "=========================================="
    echo "  HiPet Backend Service 部署脚本"
    echo "=========================================="
    echo ""
    
    check_project_dir
    setup_tmux
    pull_code
    kill_port
    install_dependencies
    start_mqtt_broker
    start_service
    
    echo ""
    print_success "部署流程完成！"
    echo ""
    print_info "查看服务日志: tmux attach -t $TMUX_SESSION"
    print_info "分离 session: Ctrl+B, d"
}

# 运行主函数
main "$@"
