# 实习生导航系统 — GitHub + Vercel + Supabase 完整部署教程

> 本教程将指导你从零开始，将实习生导航系统部署到生产环境。
> 架构：**GitHub**（代码托管）→ **Vercel**（前端 + Serverless API）→ **Supabase**（PostgreSQL 数据库）

---

## 📋 目录

1. [架构概览](#1-架构概览)
2. [创建 Supabase 项目](#2-创建-supabase-项目)
3. [初始化数据库](#3-初始化数据库)
4. [推送代码到 GitHub](#4-推送代码到-github)
5. [部署到 Vercel](#5-部署到-vercel)
6. [配置环境变量](#6-配置环境变量)
7. [验证部署](#7-验证部署)
8. [创建测试账号](#8-创建测试账号)
9. [常见问题](#9-常见问题)

---

## 1. 架构概览

```
┌─────────────┐     ┌──────────────────────────────┐     ┌──────────────┐
│   用户浏览器  │────▶│         Vercel               │────▶│   Supabase   │
│             │◀────│  ┌────────┐  ┌─────────────┐ │◀────│  PostgreSQL  │
│             │     │  │前端 SPA │  │Serverless API│ │     │   数据库     │
│             │     │  │(React) │  │  (Express)   │ │     │              │
└─────────────┘     │  └────────┘  └─────────────┘ │     └──────────────┘
                    └──────────────────────────────┘
                           ↑ 代码来源
                    ┌──────────────┐
                    │   GitHub     │
                    │   仓库       │
                    └──────────────┘
```

- **前端**：React SPA，Vite 构建，Vercel 静态托管
- **后端**：Express API，Vercel Serverless Function 运行
- **数据库**：Supabase 托管的 PostgreSQL，通过 PgBouncer 连接池连接

---

## 2. 创建 Supabase 项目

### 2.1 注册/登录 Supabase

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击 **Start your project**，使用 GitHub 账号登录
3. 点击 **New Project**

### 2.2 创建项目

| 字段 | 填写内容 |
|------|----------|
| Name | `intern-nav-system` |
| Database Password | 设置一个强密码（**请记好，后面要用**） |
| Region | 选择离你最近的区域（如 Northeast Asia - Tokyo） |
| Plan | Free（免费版足够使用） |

4. 点击 **Create new project**，等待约 2 分钟初始化完成

### 2.3 获取数据库连接字符串

1. 进入项目后，点击左侧 **Settings**（齿轮图标）
2. 点击 **Database**
3. 往下滚动到 **Connection string** 区域
4. 选择 **URI** 标签
5. 选择 **Mode: Session**（端口 6543，即 Pooler 模式）
6. 复制连接字符串，格式类似：
   ```
   postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
   ```
7. 将 `[YOUR-PASSWORD]` 替换为你创建项目时设置的密码

> **重要**：必须使用 **Pooler** 连接（端口 6543），不要用直连（端口 5432）。Vercel Serverless 环境需要连接池来管理数据库连接。

---

## 3. 初始化数据库

### 3.1 打开 SQL Editor

1. 在 Supabase 左侧菜单点击 **SQL Editor**
2. 点击 **New query**

### 3.2 执行建表脚本

1. 打开项目中的 `supabase/schema.sql` 文件
2. 复制全部内容，粘贴到 SQL Editor 中
3. 点击 **Run**（或按 `Ctrl+Enter`）
4. 看到 "Success" 提示，表示 14 张表和索引创建完成

### 3.3 执行种子数据脚本

1. 点击 **New query** 新建查询
2. 打开项目中的 `supabase/seed.sql` 文件
3. 复制全部内容，粘贴到 SQL Editor 中
4. 点击 **Run**
5. 看到 "Success" 提示，表示邀请密钥和技能树数据已导入

### 3.4 验证数据

在 SQL Editor 中执行以下查询验证：

```sql
-- 验证邀请密钥
SELECT key_value, role FROM invite_keys;

-- 验证技能树（应返回 75+ 行）
SELECT COUNT(*) FROM skills;

-- 验证表结构
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;
```

---

## 4. 推送代码到 GitHub

### 4.1 创建 GitHub 仓库

1. 访问 [https://github.com/new](https://github.com/new)
2. Repository name: `intern-nav-system`
3. 选择 **Private**（推荐）
4. **不要**勾选 "Add a README file"（已有代码）
5. 点击 **Create repository**

### 4.2 推送代码

在项目根目录打开终端：

```bash
cd intern-nav-system

# 初始化 Git（如果还没有）
git init

# 添加 .gitignore
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.db
*.sqlite
.DS_Store
.vercel/
EOF

# 添加所有文件
git add .

# 首次提交
git commit -m "feat: migrate to Supabase PostgreSQL + Vercel deployment"

# 关联远程仓库（替换为你的仓库地址）
git remote add origin https://github.com/你的用户名/intern-nav-system.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

---

## 5. 部署到 Vercel

### 5.1 导入项目

1. 访问 [https://vercel.com](https://vercel.com)，使用 GitHub 账号登录
2. 点击 **Add New** → **Project**
3. 在列表中找到 `intern-nav-system` 仓库
4. 点击 **Import**

### 5.2 配置项目

在 **Configure Project** 页面：

| 设置项 | 值 |
|--------|-----|
| Framework Preset | **Other** |
| Root Directory | `./` （保持默认，不修改） |
| Build Command | `npm run vercel-build` |
| Output Directory | `frontend/dist` |

> **注意**：不要修改 Root Directory，保持项目根目录。构建命令 `vercel-build` 会自动编译后端 TypeScript 并构建前端。

### 5.3 先不配置环境变量

暂时跳过环境变量配置（下一步专门配置），直接点击 **Deploy**。

等待首次部署完成（约 2-3 分钟），此时部署会**失败**（缺少 `DATABASE_URL`），这是正常的。

---

## 6. 配置环境变量

### 6.1 进入项目设置

1. 在 Vercel Dashboard 中点击刚创建的项目
2. 点击顶部 **Settings** 标签
3. 点击左侧 **Environment Variables**

### 6.2 添加环境变量

逐个添加以下环境变量（Environment 选择 Production / Preview / Development 全选）：

| Key | Value | 说明 |
|-----|-------|------|
| `DATABASE_URL` | `postgresql://postgres.xxxxx:密码@aws-0-区域.pooler.supabase.com:6543/postgres` | Supabase Pooler 连接字符串 |
| `JWT_SECRET` | 64位随机字符串 | JWT 签名密钥 |
| `DEEPSEEK_API_KEY` | 你的 DeepSeek API Key | AI 对话功能（可选） |
| `DEEPSEEK_API_URL` | `https://api.deepseek.com/v1` | DeepSeek API 地址 |

#### 生成 JWT_SECRET

在终端执行：

```bash
# 方法1：Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法2：PowerShell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

将输出的 64 位十六进制字符串填入 `JWT_SECRET`。

### 6.3 重新部署

1. 回到 **Deployments** 标签
2. 点击最新部署右侧的 **···** 菜单
3. 选择 **Redeploy**
4. 确认重新部署

等待部署完成，此时应该显示 **Ready** ✓

---

## 7. 验证部署

### 7.1 检查 API 健康状态

访问你的 Vercel 域名 + `/api/health`：

```
https://你的项目名.vercel.app/api/health
```

应该返回：
```json
{"status":"ok"}
```

### 7.2 检查前端

访问：
```
https://你的项目名.vercel.app
```

应该看到实习生导航系统的登录页面。

### 7.3 检查数据库连接

访问：
```
https://你的项目名.vercel.app/api/auth/keys
```

应该返回 `401 Unauthorized`（未登录），说明 API 路由正常工作。

---

## 8. 创建测试账号

系统使用邀请密钥注册，种子数据已包含 3 个默认密钥：

| 角色 | 邀请密钥 |
|------|----------|
| 导师 | `MENTOR-123456` |
| 实习生 | `INTERN-123456` |
| HR | `HR-123456` |

### 8.1 注册 HR 账号

1. 在登录页点击 **注册**
2. 填写信息：
   - 姓名：HR Admin
   - 邮箱：hr@company.com
   - 密码：Admin@2024
   - 角色：HR
   - 邀请密钥：`HR-123456`
3. 点击注册

### 8.2 注册导师账号

- 姓名：导师张工
- 邮箱：mentor@company.com
- 密码：Mentor@2024
- 角色：导师
- 部门：商务
- 邀请密钥：`MENTOR-123456`

### 8.3 注册实习生账号

- 姓名：实习生李四
- 邮箱：intern@company.com
- 密码：Intern@2024
- 角色：实习生
- 部门：商务
- 实习时间：选择起止日期
- 邀请密钥：`INTERN-123456`

---

## 9. 常见问题

### Q1: 部署成功但 API 返回 500 错误

**原因**：`DATABASE_URL` 配置错误或数据库未初始化。

**解决**：
1. 检查 Vercel 环境变量中 `DATABASE_URL` 是否正确
2. 确认密码中的特殊字符已 URL 编码（如 `#` → `%23`）
3. 确认已执行 `schema.sql` 和 `seed.sql`
4. 检查 Supabase 项目是否处于暂停状态（免费版 7 天不活跃会暂停）

### Q2: 前端页面空白

**原因**：前端 API 请求地址不对。

**解决**：
1. 确认前端代码中 API 请求使用相对路径 `/api/...`（不是绝对地址）
2. `vercel.json` 中的 rewrite 规则会自动将 `/api/*` 路由到 Serverless Function

### Q3: 数据库连接超时

**原因**：使用了直连地址（端口 5432）而非 Pooler 地址。

**解决**：
1. 确认 `DATABASE_URL` 使用 **pooler.supabase.com:6543**
2. 不要使用 **db.项目名.supabase.co:5432**

### Q4: Supabase 免费版限制

| 资源 | 免费额度 |
|------|----------|
| 数据库 | 500 MB |
| 带宽 | 5 GB/月 |
| API 请求 | 无限制 |
| 并发连接 | 60（Pooler） |
| 项目暂停 | 7 天不活跃自动暂停 |

### Q5: 如何查看 Vercel 日志

1. 进入 Vercel Dashboard → 你的项目
2. 点击 **Deployments** → 最新部署
3. 点击 **Function Logs** 查看服务端日志
4. 点击 **Runtime Logs** 查看实时日志

### Q6: 如何更新部署

```bash
# 修改代码后
git add .
git commit -m "fix: 修复xxx问题"
git push
```

Vercel 会自动检测推送并重新部署，通常 1-2 分钟完成。

### Q7: 本地开发如何连接 Supabase

1. 复制 `.env.example` 为 `.env`
2. 填入 Supabase 连接字符串
3. 运行：

```bash
# 安装依赖
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 启动后端
cd backend && npm run dev

# 启动前端（新终端）
cd frontend && npm run dev
```

---

## 📁 项目关键文件说明

```
intern-nav-system/
├── api/
│   └── [[...path]].js        # Vercel Serverless Function 入口
├── backend/
│   ├── src/
│   │   ├── db/index.ts       # PostgreSQL 连接层（兼容 better-sqlite3 API）
│   │   ├── app.ts            # Express 应用主文件
│   │   ├── start.ts          # 本地开发启动入口
│   │   ├── middleware/auth.ts # JWT 认证中间件
│   │   └── routes/           # 11 个 API 路由文件
│   ├── package.json          # 后端依赖
│   └── tsconfig.json         # TypeScript 配置
├── frontend/                 # React 前端
├── supabase/
│   ├── schema.sql            # 数据库建表脚本
│   └── seed.sql              # 种子数据脚本
├── vercel.json               # Vercel 部署配置
├── package.json              # 根依赖（含 postgres）
└── .env.example              # 环境变量模板
```

---

## 🔐 安全建议

1. **修改默认邀请密钥**：注册完测试账号后，在 Supabase SQL Editor 中删除默认密钥：
   ```sql
   DELETE FROM invite_keys WHERE key_value IN ('MENTOR-123456', 'INTERN-123456', 'HR-123456');
   ```
2. **启用 Supabase RLS**（Row Level Security）：生产环境建议为每张表配置行级安全策略
3. **定期备份数据库**：Supabase 免费版支持每日自动备份
4. **保护 JWT_SECRET**：不要将密钥提交到代码仓库

---

> 🎉 部署完成！你的实习生导航系统现在已上线运行。
