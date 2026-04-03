# PWA 部署指南

## 零成本部署方案

### 1. 准备图标

打开 `public/icon-generator.html`，上传你的图片，下载所有尺寸的图标到 `public/icons/` 目录。

### 2. 推送到 GitHub

```bash
# 在项目根目录初始化 git
git init
git add .
git commit -m "Initial PWA setup"

# 创建 GitHub 仓库并推送
git remote add origin https://github.com/你的用户名/ryan-wenwen-schedule.git
git push -u origin main
```

### 3. 部署到 Vercel

1. 访问 [vercel.com](https://vercel.com) 并登录（可用 GitHub 账号）
2. 点击 "New Project"
3. 选择你的 GitHub 仓库
4. 配置：
   - Framework Preset: `Other`
   - Build Command: （留空）
   - Output Directory: `public`
5. 点击 Deploy

### 4. 配置域名（可选）

Vercel 会自动分配域名如 `your-project.vercel.app`，免费使用。

### 5. 添加到手机主屏幕

**iPhone/iPad:**
1. Safari 打开网站
2. 点击分享按钮（底部中间）
3. 选择 "添加到主屏幕"

**Android:**
1. Chrome 打开网站
2. 点击菜单（右上角三点）
3. 选择 "添加到主屏幕"

---

## 后续迁移到 Supabase（可选）

当需要更强大的后端时，可以迁移到 Supabase：

1. 注册 [supabase.com](https://supabase.com)
2. 创建项目（免费 tier）
3. 执行数据库迁移脚本
4. 修改前端 API 调用

详见 `supabase-migration.md`
