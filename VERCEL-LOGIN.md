# Vercel 登录指南

## 方式一：用 GitHub 账号登录（推荐 ✅）

既然你已经注册了 GitHub，这是最方便的方式。

### 步骤：

1. **访问 Vercel 登录页面**
   - 打开浏览器访问：https://vercel.com/login

2. **点击 GitHub 图标**
   ```
   ┌─────────────────────────────────────┐
   │                                     │
   │   Continue with GitHub    ← 点这个 │
   │                                     │
   │   Continue with GitLab              │
   │                                     │
   │   Continue with Bitbucket           │
   │                                     │
   └─────────────────────────────────────┘
   ```

3. **授权 Vercel 访问 GitHub**
   - 如果已经登录了 GitHub，会直接跳转到授权页面
   - 点击绿色的 **"Authorize Vercel"** 按钮

4. **完成！**
   - 会自动跳转到 Vercel Dashboard（控制台）
   - 网址：https://vercel.com/dashboard

---

## 方式二：用邮箱登录

如果你不想用 GitHub 登录：

1. 访问 https://vercel.com/signup
2. 输入你的邮箱地址
3. 去邮箱查收验证邮件
4. 点击邮件中的链接即可登录

---

## 验证是否登录成功

打开 https://vercel.com/dashboard

如果看到类似这样的页面，说明登录成功：
```
┌────────────────────────────────────────┐
│  Vercel              [+] New Project   │
├────────────────────────────────────────┤
│                                        │
│   Welcome to Vercel!                   │
│                                        │
│   Import Git Repository →              │
│                                        │
└────────────────────────────────────────┘
```

如果看到登录框，说明还未登录。

---

## 登录后需要做的事情

登录 Vercel 后，只需要做一件事：

### 导入 GitHub 仓库并部署

1. 在 Dashboard 点击 **"Add New..."** → **"Project"**

2. 找到你的 GitHub 仓库 `ryan-wenwen-schedule`
   ```
   ┌─────────────────────────────────────────┐
   │  Import Git Repository                  │
   │                                         │
   │  ┌───────────────────────────────┐     │
   │  │ 🔍 Search repositories...     │     │
   │  └───────────────────────────────┘     │
   │                                         │
   │  ryan-wenwen-schedule     ← 找到这个   │
   │  ────────────────────────               │
   │  Import                                 │
   └─────────────────────────────────────────┘
   ```

3. 点击 **Import**

4. 配置项目（⚠️ 重要）：
   ```
   ┌─────────────────────────────────────────┐
   │  Configure Project                      │
   │                                         │
   │  Framework Preset:                      │
   │  ┌───────────────────────────────┐     │
   │  │ Other                         │ ← 选这个 │
   │  └───────────────────────────────┘     │
   │                                         │
   │  Build and Output Settings              │
   │  Build Command: (留空)                  │
   │  Output Directory: .    ← 输入一个点    │
   │                                         │
   │  [Deploy]                               │
   └─────────────────────────────────────────┘
   ```

5. 点击 **Deploy**

6. 等待 1-2 分钟，部署完成！

---

## 常见问题

### Q: 提示 "No GitHub repositories found"
A: 点击 "Adjust GitHub App Permissions" → 选择 "All repositories" → Save

### Q: 找不到我的仓库
A: 确保你已经把代码推送到 GitHub 了：
```bash
cd "/Users/rshen/Desktop/Claude code"
git push -u origin main
```

### Q: 部署失败显示 "404"
A: 检查 Output Directory 是否设置为 `.`（一个点），不是 `public`

### Q: 如何更新网站？
A: 每次推送代码到 GitHub，Vercel 会自动重新部署：
```bash
git add .
git commit -m "更新内容"
git push
```

---

## 下一步

登录并完成首次部署后，你可以：
1. 获取网站地址（如 `https://ryan-wenwen-schedule.vercel.app`）
2. 在手机上用 Safari/Chrome 打开
3. 添加到主屏幕，完成 PWA 安装！
