# 后端部署指南 (Render)

## 概述

我们将使用 **Render**（免费云服务）部署后端 API，这样手机和电脑都能访问。

**部署后：**
- 前端网址：`https://ryan-wenwen-schedule.vercel.app`
- 后端网址：`https://ryan-wenwen-schedule-api.onrender.com`

---

## 步骤 1：注册 Render 账号

1. 访问 https://dashboard.render.com
2. 点击 **"Get Started for Free"**
3. 选择 **"Continue with GitHub"**
4. 授权 Render 访问你的 GitHub 账号
5. 验证邮箱（去邮箱点击链接）

---

## 步骤 2：创建 Web Service

1. 登录后点击 dashboard 上的 **"New +"** 按钮
2. 选择 **"Web Service"**

```
┌─────────────────────────────────────┐
│  New +                              │
│  ├─ Web Service    ← 选这个        │
│  ├─ Background Worker               │
│  ├─ Static Site                     │
│  └─ PostgreSQL                      │
└─────────────────────────────────────┘
```

3. 找到并点击你的仓库：**shen0726/ryan-wenwen-schedule**

4. 填写配置：

| 配置项 | 填写内容 |
|--------|----------|
| **Name** | `ryan-wenwen-schedule-api` |
| **Region** | `Singapore` (亚洲最近) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server/server.js` |
| **Plan** | `Free` |

5. 展开 **"Advanced"** 部分，添加环境变量：
   - 点击 **"Add Environment Variable"**
   - Key: `NODE_ENV`
   - Value: `production`

6. 点击页面底部的 **"Create Web Service"**

---

## 步骤 3：等待部署完成

- 部署过程约 2-5 分钟
- 看到 **"Your service is live"** 表示成功
- 记录你的后端网址，类似：
  ```
  https://ryan-wenwen-schedule-api.onrender.com
  ```

---

## 步骤 4：修改前端配置

部署完成后，需要告诉前端去哪里找后端。

### 修改 index.html

1. 在代码中找到 API 调用的地方（搜索 `localhost:3000`）
2. 替换为 Render 的网址

**替换前：**
```javascript
const API_BASE = 'http://localhost:3000';
```

**替换后：**
```javascript
const API_BASE = 'https://ryan-wenwen-schedule-api.onrender.com';
```

3. 提交并推送：
```bash
cd "/Users/rshen/Desktop/Claude code"
git add index.html
git commit -m "Update API endpoint to Render"
git push origin main
```

4. Vercel 会自动重新部署前端（约 1 分钟）

---

## 完成！

现在手机和电脑都能正常使用：
- 打开 `https://ryan-wenwen-schedule.vercel.app`
- 注册/登录应该正常工作

---

## 注意事项

### 免费版限制
- **休眠机制**：15 分钟无访问会自动休眠，下次访问需要等待 30 秒唤醒
- **每月 500 小时**：足够个人使用

### 数据持久化
- 用户数据、日程数据都保存在 Render 的磁盘上
- **不要**在代码中删除 `server/data/` 目录下的文件

### 如果后端网址变了
1. 在 Render Dashboard 找到你的服务
2. 点击 **"Settings"**
3. 可以自定义域名或查看当前网址

---

## 故障排除

### 问题：手机能打开网页但无法登录
**解决**：检查前端 API_BASE 是否已改为 Render 网址

### 问题：提示 "Failed to fetch"
**解决**：后端可能休眠了，等待 30 秒后重试，或访问 Render 网址唤醒服务

### 问题：数据丢失
**解决**：免费版磁盘在重新部署时可能重置，重要数据建议定期备份 `server/data/` 目录
