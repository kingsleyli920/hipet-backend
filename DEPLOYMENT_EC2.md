# EC2 部署指南 - HiPet Backend + AI Agent Service

本指南适用于 Amazon Linux EC2 实例，使用 tmux 进行服务管理。

## 📋 前置准备

- EC2 实例已创建（Amazon Linux 2023 或 Amazon Linux 2）
- 已通过 SSH 连接到 EC2 实例
- 有 sudo 权限

---

## 🔧 Step 1: 系统更新和基础工具安装

```bash
# 更新系统包
sudo yum update -y

# 安装基础开发工具和编译工具
sudo yum groupinstall -y "Development Tools"
sudo yum install -y git curl wget vim

# 安装 tmux（用于后台运行服务）
sudo yum install -y tmux
```

---

## 🐍 Step 2: 安装 Python 3.11+

```bash
# 检查 Python 版本
python3 --version

# 如果版本低于 3.11，需要安装 Python 3.11
# Amazon Linux 2023 通常自带 Python 3.11+
# 如果是 Amazon Linux 2，需要额外安装：

# Amazon Linux 2 安装 Python 3.11
sudo yum install -y python3.11 python3.11-pip python3.11-devel

# 设置 Python 3.11 为默认版本（可选）
sudo alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# 安装 pip（如果还没有）
python3 -m ensurepip --upgrade
python3 -m pip install --upgrade pip

# 验证安装
python3 --version
pip3 --version
```

---

## 📦 Step 3: 安装 Bun（Node.js Runtime）

Backend service 使用 Bun，需要安装 Bun：

```bash
# 使用官方安装脚本
curl -fsSL https://bun.sh/install | bash

# 将 Bun 添加到 PATH
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 验证安装
bun --version
```

---

## 📁 Step 4: 克隆项目代码

```bash
# 进入用户目录
cd ~

# 方法 1: 使用 HTTPS（推荐，最简单）
git clone https://github.com/kingsleyli920/hipet-backend.git

# 如果是私有仓库，需要输入 GitHub 用户名和 Personal Access Token
# 用户名: 你的 GitHub 用户名
# 密码: 使用 Personal Access Token（不是 GitHub 密码）
# 创建 Token: https://github.com/settings/tokens

# 方法 2: 使用 SSH（需要先配置 SSH key，见下方说明）
# git clone git@github.com:kingsleyli920/hipet-backend.git

# 进入项目目录
cd hipet-backend
```

### 4.1 配置 Deploy Key（推荐用于私有仓库）

Deploy Key 是针对特定仓库的 SSH key，比 Personal Access Token 更安全：

```bash
# 1. 在 EC2 上生成 SSH key（专用于此仓库）
ssh-keygen -t ed25519 -C "ec2-hipet-backend" -f ~/.ssh/hipet_backend_deploy_key
# 按 Enter 两次（不设置密码，用于自动化部署）

# 2. 查看并复制公钥内容
cat ~/.ssh/hipet_backend_deploy_key.pub

# 3. 将公钥添加到 GitHub Deploy Keys
# 访问: https://github.com/kingsleyli920/hipet-backend/settings/keys
# 或: Settings -> Deploy keys -> Add deploy key
# Title: hipet-backend-ec2 (或你喜欢的名称)
# Key: 粘贴上面复制的公钥内容
# Allow write access: 根据需要勾选（通常只读即可，如果需要推送代码则勾选）

# 4. 配置 SSH config 使用专用 key
cat >> ~/.ssh/config << 'EOF'
Host github.com-hipet-backend
    HostName github.com
    User git
    IdentityFile ~/.ssh/hipet_backend_deploy_key
    IdentitiesOnly yes
EOF

# 5. 设置正确的权限
chmod 600 ~/.ssh/hipet_backend_deploy_key
chmod 644 ~/.ssh/hipet_backend_deploy_key.pub
chmod 600 ~/.ssh/config

# 6. 使用 Deploy Key 克隆仓库（注意使用配置的 Host）
git clone git@github.com-hipet-backend:kingsleyli920/hipet-backend.git

# 或者，如果想直接用标准方式，需要将 key 加入 ssh-agent：
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/hipet_backend_deploy_key
git clone git@github.com:kingsleyli920/hipet-backend.git
```

**Deploy Key vs SSH Key 的区别：**
- **Deploy Key**: 只针对特定仓库，更安全，适合服务器部署
- **SSH Key**: 添加到个人账户，可以访问所有仓库

---

## 🔐 Step 5: 配置环境变量

### 5.1 Backend Service 环境变量

```bash
# 进入 backend-service 目录
cd ~/hipet-backend/backend-service

# 复制示例环境变量文件
cp env.example .env

# 编辑 .env 文件（使用 vim 或其他编辑器）
vim .env
```

**需要配置的关键变量：**
```bash
# Database（使用 RDS，填写 RDS 连接地址）
DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/hipet"

# Redis（如果需要，可以使用 ElastiCache 或本地 Redis）
REDIS_URL="redis://your-redis-endpoint:6379"

# JWT Secret（生成一个随机字符串）
JWT_SECRET="your-secure-jwt-secret-here"

# API 配置
PORT=8000
NODE_ENV=production
API_BASE_URL="http://your-ec2-public-ip:8000"
FRONTEND_URL="http://your-frontend-domain.com"

# AI Agent Service URL
AGENT_SERVICE_URL="http://localhost:8001"

# Google OAuth（如果需要）
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# 其他 AWS 服务配置...
```

### 5.2 Agent Service 环境变量

```bash
# 进入 agent-service 目录
cd ~/hipet-backend/agent-service

# 创建 .env 文件
vim .env
```

**需要配置的关键变量：**
```bash
# Google Vertex AI 配置
GOOGLE_PROJECT_ID="your-google-project-id"
GOOGLE_LOCATION="us-central1"
GOOGLE_APPLICATION_CREDENTIALS="/home/ec2-user/hipet-backend/agent-service/google-credentials.json"
LLM_MODEL="gemini-1.5-pro"

# 服务配置
AGENT_SERVICE_HOST="0.0.0.0"
AGENT_SERVICE_PORT=8001
LOG_LEVEL="info"
```

### 5.3 上传 Google 认证文件

```bash
# 在本地机器上，使用 SCP 上传 Google 服务账号密钥文件
# scp /path/to/your/google-credentials.json ec2-user@your-ec2-ip:~/hipet-backend/agent-service/

# 或者在 EC2 上直接创建文件（如果已配置）
vim ~/hipet-backend/agent-service/google-credentials.json
# 粘贴你的 Google 服务账号 JSON 内容

# 设置文件权限（安全考虑）
chmod 600 ~/hipet-backend/agent-service/google-credentials.json
```

---

## 🔨 Step 6: 安装项目依赖

### 6.1 安装 Backend Service 依赖

```bash
cd ~/hipet-backend/backend-service

# 安装依赖
bun install

# 生成 Prisma Client
bunx prisma generate

# 运行数据库迁移（连接到 RDS）
bunx prisma db push
```

### 6.2 安装 Agent Service 依赖

```bash
cd ~/hipet-backend/agent-service

# 安装 Python 依赖
pip3 install -r requirements.txt

# 验证安装
python3 -c "import fastapi, vertexai, loguru; print('Dependencies OK')"
```

---

## 🚀 Step 7: 配置 EC2 安全组

在 AWS 控制台中配置安全组，开放以下端口：

- **8000**: Backend Service
- **8001**: Agent Service
- **22**: SSH（默认已开放）

---

## 🎭 Step 8: 使用 Tmux 启动服务

### 8.1 创建 Tmux Session

```bash
# 创建一个名为 'hipet' 的 tmux session
tmux new -s hipet

# 或者在已存在的 session 中工作
# tmux attach -t hipet
```

### 8.2 在 Tmux 中分割窗口

```bash
# 在 tmux 中，使用快捷键分割窗口：
# Ctrl+B 然后按 %  （垂直分割）
# Ctrl+B 然后按 "  （水平分割）

# 或者创建两个 pane：
# 左侧运行 Backend Service
# 右侧运行 Agent Service
```

### 8.3 启动 Backend Service（左侧 pane）

```bash
cd ~/hipet-backend/backend-service
bun run start
```

### 8.4 启动 Agent Service（右侧 pane）

```bash
cd ~/hipet-backend/agent-service
python3 main.py
```

### 8.5 Tmux 常用操作

```bash
# 分离 session（服务继续运行，按 Ctrl+B 然后按 d）
# Ctrl+B, d

# 重新连接 session
tmux attach -t hipet

# 列出所有 session
tmux ls

# 终止 session
tmux kill-session -t hipet

# 在 tmux 中切换 pane
# Ctrl+B 然后按方向键

# 滚动查看日志
# Ctrl+B 然后按 [，使用方向键滚动，按 q 退出
```

---

## ✅ Step 9: 验证服务运行

### 9.1 检查端口占用

```bash
# 检查端口是否被占用
sudo netstat -tlnp | grep -E '8000|8001'

# 或者使用
sudo ss -tlnp | grep -E '8000|8001'
```

### 9.2 测试健康检查端点

```bash
# 测试 Backend Service
curl http://localhost:8000/health/

# 测试 Agent Service
curl http://localhost:8001/health/

# 从外部测试（使用 EC2 公网 IP）
curl http://your-ec2-public-ip:8000/health/
curl http://your-ec2-public-ip:8001/health/
```

---

## 🔄 Step 10: 重启服务流程

如果需要重启服务：

```bash
# 1. 连接到 tmux session
tmux attach -t hipet

# 2. 停止当前服务（在对应的 pane 中按 Ctrl+C）

# 3. 重新启动
# Backend Service:
cd ~/hipet-backend/backend-service && bun run start

# Agent Service:
cd ~/hipet-backend/agent-service && python3 main.py

# 4. 分离 session
# Ctrl+B, d
```

---

## 📝 Step 11: 查看日志

### 在 Tmux 中查看日志

```bash
# 连接到 tmux session
tmux attach -t hipet

# 在对应的 pane 中查看实时日志
# 如果需要滚动历史日志：
# Ctrl+B, [ （进入复制模式）
# 使用方向键或 Page Up/Down 滚动
# 按 q 退出
```

### 查看系统日志（如果有配置）

```bash
# 如果服务崩溃，查看系统日志
sudo journalctl -u your-service-name -f
```

---

## 🔧 故障排查

### 问题 1: 端口被占用

```bash
# 查找占用端口的进程
sudo lsof -i :8000
sudo lsof -i :8001

# 终止进程
sudo kill -9 <PID>
```

### 问题 2: 数据库连接失败

```bash
# 检查 RDS 安全组是否允许 EC2 访问
# 检查 DATABASE_URL 配置是否正确
# 测试数据库连接
psql -h your-rds-endpoint -U username -d hipet
```

### 问题 3: Google 认证失败

```bash
# 检查认证文件路径和权限
ls -la ~/hipet-backend/agent-service/google-credentials.json
chmod 600 ~/hipet-backend/agent-service/google-credentials.json

# 检查环境变量
echo $GOOGLE_APPLICATION_CREDENTIALS
```

### 问题 4: 依赖安装失败

```bash
# Python 依赖
pip3 install --upgrade pip
pip3 install -r requirements.txt --no-cache-dir

# Bun 依赖
cd backend-service
rm -rf node_modules
bun install
```

---

## 🎯 下一步

- 配置 Nginx 反向代理（可选）
- 配置 SSL 证书（使用 Let's Encrypt）
- 设置系统服务（systemd）替代 tmux（可选）
- 配置日志轮转
- 设置监控和告警

---

## 📌 重要提示

1. **安全组配置**: 确保只开放必要的端口，限制 IP 访问
2. **环境变量**: 不要在代码中硬编码敏感信息，使用 `.env` 文件
3. **备份**: 定期备份 `.env` 文件（但不提交到 git）
4. **日志管理**: 考虑配置日志轮转，避免日志文件过大
5. **监控**: 考虑使用 CloudWatch 或其他监控工具
