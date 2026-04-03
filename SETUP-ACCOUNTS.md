# 账号注册指南

## 第一步：注册 GitHub 账号（3 分钟）

GitHub 是代码托管平台，类似代码的「网盘」。

1. 访问 https://github.com/signup
2. 输入你的邮箱地址（建议使用常用邮箱）
3. 设置密码（至少 8 位，包含字母和数字）
4. 设置用户名（建议使用简短英文，如 `ryan-dev`）
5. 完成验证（可能是拼图或选择图片）
6. 选择免费计划（Free）
7. 去邮箱点击验证链接

✅ **完成验证后，你就有了 GitHub 账号！**

---

## 第二步：注册 Vercel 账号（1 分钟）

Vercel 是部署平台，会自动发布你的网站。

1. 访问 https://vercel.com/signup
2. 点击 **Continue with GitHub**
3. 授权 Vercel 访问你的 GitHub 账号
4. 点击 **Authorize Vercel**

✅ **完成！Vercel 账号自动创建，无需额外注册！**

---

## 第三步：运行自动部署脚本

注册完成后，打开终端运行：

```bash
cd "/Users/rshen/Desktop/Claude code"
./deploy.sh
```

脚本会：
- 自动登录 GitHub 和 Vercel
- 创建仓库并推送代码
- 部署网站
- 给你最终的网址

---

## 📋 注册前准备

| 项目 | 说明 |
|------|------|
| 邮箱 | 常用邮箱（接收验证邮件）|
| 密码管理 | 建议用浏览器记住密码 |
| 用户名 | 简短英文，用于网址 |

---

## ❓ 常见问题

**Q: 注册 GitHub 需要信用卡吗？**  
A: 不需要！个人免费版完全够用。

**Q: Vercel 收费吗？**  
A: 免费版包含：无限静态网站、每月 100GB 流量、HTTPS 证书，对个人项目完全足够。

**Q: 用户名可以改吗？**  
A: 可以，以后随时在设置中修改。

---

## 🎯 完成后

部署成功后，你的网站地址会是：
```
https://你的用户名-ryan-wenwen-schedule.vercel.app
```

或者如果你设置了项目名称：
```
https://ryan-wenwen-schedule.vercel.app
```

将这个地址发给 Wenwen，她就能在手机上添加 PWA 了！
