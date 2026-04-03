#!/bin/bash
# PWA 一键部署脚本

set -e

echo "🚀 Ryan和Wenwen的日程表 - 自动部署脚本"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "📦 安装 GitHub CLI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install gh
        else
            echo "请先安装 Homebrew: https://brew.sh"
            exit 1
        fi
    else
        # Linux
        curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
        sudo apt update && sudo apt install gh
    fi
fi

# 检查 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "📦 安装 Vercel CLI..."
    npm install -g vercel
fi

echo ""
echo "🔐 步骤 1/4: 登录 GitHub"
echo "------------------------"
gh auth status &> /dev/null || gh auth login

echo ""
echo "📁 步骤 2/4: 创建 GitHub 仓库"
echo "-----------------------------"

# 获取当前目录名作为默认仓库名
DEFAULT_REPO="ryan-wenwen-schedule"
read -p "输入仓库名称 (默认: $DEFAULT_REPO): " REPO_NAME
REPO_NAME=${REPO_NAME:-$DEFAULT_REPO}

# 检查仓库是否已存在
if gh repo view "$REPO_NAME" &> /dev/null 2>&1; then
    echo "⚠️  仓库 $REPO_NAME 已存在"
    read -p "是否推送到现有仓库? (y/n): " CONFIRM
    if [[ $CONFIRM != "y" ]]; then
        echo "取消部署"
        exit 1
    fi
else
    echo "创建新仓库: $REPO_NAME"
    gh repo create "$REPO_NAME" --public --source=. --push
fi

# 设置远程仓库（如果还没设置）
if ! git remote get-url origin &> /dev/null; then
    gh repo view "$REPO_NAME" --json url -q '.url' &> /dev/null || {
        echo "❌ 仓库不存在，正在创建..."
        gh repo create "$REPO_NAME" --public
    }
    git remote add origin "https://github.com/$(gh api user -q '.login')/$REPO_NAME.git"
fi

# 推送代码
echo ""
echo "📤 推送代码到 GitHub..."
git push -u origin main || git push -u origin master

echo ""
echo "✅ GitHub 仓库已更新: https://github.com/$(gh api user -q '.login')/$REPO_NAME"

echo ""
echo "🚀 步骤 3/4: 部署到 Vercel"
echo "--------------------------"
echo "请在浏览器中完成 Vercel 登录..."

# 检查是否已登录 Vercel
vercel whoami &> /dev/null || vercel login

echo ""
echo "配置 Vercel 项目..."

# 创建 vercel.json 配置文件
cat > vercel.json << 'EOF'
{
  "version": 2,
  "public": true,
  "github": {
    "enabled": true
  }
}
EOF

git add vercel.json
git commit -m "Add Vercel configuration" || true
git push

echo ""
echo "🚀 开始部署..."
vercel --prod --confirm --name "$REPO_NAME"

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""

# 获取部署后的 URL
DEPLOY_URL=$(vercel list --meta githubRepo="$REPO_NAME" 2>/dev/null | grep -oE 'https?://[^ ]+\.vercel\.app' | head -1)

if [ -n "$DEPLOY_URL" ]; then
    echo "🌐 你的网站地址: $DEPLOY_URL"
    echo ""
    echo "📱 在手机上添加 PWA:"
    echo "   1. 用 Safari (iOS) 或 Chrome (Android) 打开 $DEPLOY_URL"
    echo "   2. 点击分享/菜单按钮"
    echo "   3. 选择 '添加到主屏幕'"
else
    echo "🌐 请访问 Vercel Dashboard 查看部署状态:"
    echo "   https://vercel.com/dashboard"
fi

echo ""
echo "🔧 后续操作:"
echo "   - 更新代码: git push"
echo "   - 查看日志: vercel logs"
echo "   - 管理域名: vercel domains"
echo ""
echo "🎉 恭喜！你的 PWA 日程表已上线！"
