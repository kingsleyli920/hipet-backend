#!/bin/bash
# 在阿里云服务器上执行的完整设置脚本

set -e

echo "=== 1. 生成 SSH 密钥 ==="
ssh-keygen -t ed25519 -C "aliyun-ecs-deploy" -f ~/.ssh/github_deploy_key -N ""

echo ""
echo "=== 2. 显示公钥（复制这个添加到 GitHub Deploy Keys） ==="
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat ~/.ssh/github_deploy_key.pub
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "=== 3. 配置 SSH config ==="
mkdir -p ~/.ssh
chmod 700 ~/.ssh

cat >> ~/.ssh/config << 'CONFIG_EOF'
Host github-deploy
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy_key
    IdentitiesOnly yes
CONFIG_EOF

chmod 600 ~/.ssh/github_deploy_key
chmod 644 ~/.ssh/github_deploy_key.pub
chmod 600 ~/.ssh/config

echo "✅ SSH 配置完成！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 下一步操作："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. 复制上面显示的公钥内容（ssh-ed25519 开头的那一行）"
echo "2. 打开 GitHub: https://github.com/kingsleyli920/hipet-backend/settings/keys"
echo "3. 点击 'Add deploy key'"
echo "4. Title: Aliyun ECS"
echo "5. Key: 粘贴公钥"
echo "6. Allow write access: 不勾选（只读即可）"
echo "7. 点击 'Add key'"
echo ""
echo "完成后，运行以下命令克隆仓库："
echo "  git clone git@github-deploy:kingsleyli920/hipet-backend.git"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"


