# Supabase PostgreSQL 迁移指南

## 概述
将 JSON 文件存储迁移到 Supabase PostgreSQL，实现数据永久保存。

## 优势
- ✅ 数据永久保存（不会随部署重置）
- ✅ 免费额度：500MB 存储，每月 50 万请求
- ✅ 自带用户认证（可简化代码）
- ✅ 中国大陆访问比 Render 更稳定

## 迁移计划

### Phase 1: 准备（当前分支）
1. 注册 Supabase 账号
2. 创建项目和数据库
3. 创建数据表结构

### Phase 2: 后端改造
1. 安装 Supabase 客户端
2. 创建数据库连接
3. 重写 API 使用 SQL 查询
4. 保留原有 JSON 作为 fallback

### Phase 3: 数据迁移
1. 导出现有 JSON 数据
2. 导入到 Supabase
3. 测试验证

### Phase 4: 切换和部署
1. 合并到 main 分支
2. 更新 Render 环境变量
3. 切换 API 指向 Supabase

## 回滚方案
如果出现问题，立即切换回 main 分支，使用原有 JSON 存储。

```bash
git checkout main
git push origin main
```

## 时间表
- Phase 1-2: 1-2 小时（今天）
- Phase 3: 30 分钟
- Phase 4: 10 分钟

**总耗时：约 2-3 小时，可分段完成**
