#!/bin/bash
# 配置 SSH 使用已存在的密钥

set -e

echo "=== 配置 SSH config ==="

# 确保 .ssh 目录权限正确
chmod 700 ~/.ssh
chmod 600 ~/.ssh/aliyun_ecs_deploy
chmod 644 ~/.ssh/aliyun_ecs_deploy.pub

# 添加 SSH config
cat >> ~/.ssh/config << 'CONFIG_EOF'
Host github-deploy
    HostName github.com
    User git
    IdentityFile ~/.ssh/aliyun_ecs_deploy
    IdentitiesOnly yes
CONFIG_EOF

chmod 600 ~/.ssh/config

echo "✅ SSH config 配置完成！"
echo ""
echo "=== 测试 GitHub 连接 ==="
ssh -T git@github-deploy || true

echo ""
echo "=== 现在可以克隆仓库了 ==="
echo "运行命令："
echo "  git clone git@github-deploy:kingsleyli920/hipet-backend.git"


