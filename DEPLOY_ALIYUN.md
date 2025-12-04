# 阿里云部署指南

## 1. 在阿里云服务器上生成 SSH 密钥

```bash
# SSH 登录到阿里云服务器
ssh root@your-aliyun-ip

# 生成 SSH 密钥对（用于 GitHub Deploy Key）
ssh-keygen -t ed25519 -C "aliyun-ecs-deploy" -f ~/.ssh/github_deploy_key -N ""

# 查看公钥（复制这个内容，添加到 GitHub Deploy Keys）
cat ~/.ssh/github_deploy_key.pub
```

## 2. 将公钥添加到 GitHub Deploy Keys

1. 打开 GitHub 仓库设置：`Settings` → `Deploy keys` → `Add deploy key`
2. **Title**: `Aliyun ECS`
3. **Key**: 粘贴上面 `cat ~/.ssh/github_deploy_key.pub` 的输出
4. **Allow write access**: 如果需要推送代码，勾选（通常部署只需要 pull，不勾选）
5. 点击 `Add key`

## 3. 配置 Git 使用 Deploy Key

```bash
# 在阿里云服务器上配置 SSH config
cat >> ~/.ssh/config << 'EOF'
Host github-deploy
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy_key
    IdentitiesOnly yes
EOF

# 设置正确的权限
chmod 600 ~/.ssh/github_deploy_key
chmod 644 ~/.ssh/github_deploy_key.pub
chmod 600 ~/.ssh/config
```

## 4. 克隆或更新代码

```bash
# 如果还没有克隆仓库
git clone git@github-deploy:your-username/your-repo.git

# 如果已经克隆，更新 remote URL
cd your-repo
git remote set-url origin git@github-deploy:your-username/your-repo.git

# 拉取最新代码
git pull origin main
```

## 5. 部署脚本示例

### Backend Service 部署

```bash
#!/bin/bash
# deploy_backend.sh

cd /path/to/hipet-backend/backend-service

# 拉取最新代码
git pull origin main

# 安装依赖
bun install

# 运行数据库迁移
bunx prisma migrate deploy

# 重启服务（根据你的进程管理方式）
# 如果使用 PM2:
pm2 restart hipet-backend

# 如果使用 systemd:
sudo systemctl restart hipet-backend

# 如果使用 Docker:
docker-compose up -d --build
```

### Agent Service 部署

```bash
#!/bin/bash
# deploy_agent.sh

cd /path/to/hipet-backend/agent-service

# 拉取最新代码
git pull origin main

# 安装依赖
pip install -r requirements.txt

# 重启服务
# 如果使用 systemd:
sudo systemctl restart hipet-agent

# 如果使用 supervisor:
sudo supervisorctl restart hipet-agent

# 如果使用 Docker:
docker-compose up -d --build
```

## 6. 一键部署脚本

创建 `deploy.sh`：

```bash
#!/bin/bash
set -e

REPO_DIR="/path/to/hipet-backend"
BRANCH="main"

echo "🚀 Starting deployment..."

cd $REPO_DIR

# 拉取最新代码
echo "📥 Pulling latest code..."
git pull origin $BRANCH

# 部署 Backend Service
echo "🔧 Deploying backend service..."
cd backend-service
bun install
bunx prisma migrate deploy
# 重启服务命令根据实际情况修改
pm2 restart hipet-backend || sudo systemctl restart hipet-backend

# 部署 Agent Service
echo "🤖 Deploying agent service..."
cd ../agent-service
pip install -r requirements.txt
# 重启服务命令根据实际情况修改
sudo systemctl restart hipet-agent || sudo supervisorctl restart hipet-agent

echo "✅ Deployment completed!"
```

## 7. 设置自动部署（可选）

### 使用 GitHub Actions 触发部署

在阿里云服务器上运行一个 webhook 服务，接收 GitHub Actions 的部署请求。

### 使用 Cron 定时拉取

```bash
# 编辑 crontab
crontab -e

# 添加定时任务（每小时检查一次）
0 * * * * cd /path/to/hipet-backend && git pull origin main && /path/to/deploy.sh
```

## 注意事项

1. **安全性**：
   - Deploy Key 只给 pull 权限（除非需要 push）
   - 私钥文件权限设置为 600
   - 不要在代码中提交私钥

2. **环境变量**：
   - 确保 `.env` 文件已配置
   - 不要提交 `.env` 到 Git

3. **数据库**：
   - 生产环境使用 `prisma migrate deploy`（不是 `dev`）
   - 确保数据库连接配置正确

4. **服务管理**：
   - 使用 PM2、systemd 或 supervisor 管理进程
   - 配置自动重启和日志


