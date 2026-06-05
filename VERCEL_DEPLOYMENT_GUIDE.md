# 实习生导航系统 — Vercel 部署完整教程

---

## 一、部署架构总览

```
用户浏览器
    │
    ├── /api/*  ──→  Vercel Serverless Function (Express)
    │                  └── SQLite (/tmp/intern_nav.db，冷启动后丢失)
    │
    └── 其他路径 ──→  Vercel 静态托管 (React SPA)
```

- **前端**：React + Vite → 静态文件，由 Vercel CDN 托管
- **后端**：Express 应用作为 Serverless Function 运行
- **数据库**：SQLite 存放在 `/tmp`（临时存储，适合演示）

### 默认测试账号（冷启动后自动创建）

| 角色 | 邮箱 | 密码 |
|------|------|------|
| HR | hr@company.com | Admin@2024 |
| 导师 | mentor@company.com | Mentor@2024 |
| 实习生 | intern@company.com | Intern@2024 |

---

## 二、本地验证构建

部署前先确认项目能正常构建：

```bash
cd c:\Users\32717\Desktop\demo设计\intern-nav-system

# 1. 安装根目录依赖
npm install

# 2. 构建后端（TypeScript → JavaScript）
cd backend
npm install
npx tsc
cd ..

# 3. 构建前端（React → 静态文件）
cd frontend
npm install
npx vite build
cd ..
```

确认以下目录已生成：
- `backend/dist/` — 包含 `app.js`、`db.js` 等
- `frontend/dist/` — 包含 `index.html` 和 `assets/`

> 如果构建报错，先修复错误再继续。

---

## 三、初始化 Git 并推送到 GitHub

### 步骤 1：初始化 Git

```bash
cd c:\Users\32717\Desktop\demo设计\intern-nav-system
git init
git add .
git commit -m "feat: initial commit with Vercel config"
```

### 步骤 2：创建 GitHub 仓库

1. 打开 https://github.com/new
2. 填写仓库名称：`intern-nav-system`
3. 选择 **Private**（推荐，项目含 API Key）
4. **不要**勾选 README / .gitignore / License
5. 点击 **Create repository**

### 步骤 3：推送代码

```bash
# HTTPS 方式
git remote add origin https://github.com/你的用户名/intern-nav-system.git
git branch -M main
git push -u origin main

# 或 SSH 方式
git remote add origin git@github.com:你的用户名/intern-nav-system.git
git branch -M main
git push -u origin main
```

---

## 四、在 Vercel 导入项目

### 步骤 1：登录 Vercel

打开 https://vercel.com ，使用 GitHub 账号登录。

### 步骤 2：导入仓库

1. 点击 **Add New...** → **Project**
2. 找到 `intern-nav-system` 仓库
3. 点击 **Import**

### 步骤 3：配置项目

在 **Configure Project** 页面：

| 配置项 | 应填值 | 说明 |
|--------|--------|------|
| Project Name | `intern-nav-system` | 可自定义 |
| Framework Preset | **Other** | 必须选 Other，让 vercel.json 接管 |
| Root Directory | `.` | 默认即可 |
| Build Command | 留空 | vercel.json 已定义 |
| Output Directory | 留空 | vercel.json 已定义 |
| Install Command | 留空 | vercel.json 已定义 |

> ⚠️ **关键**：Framework 一定要选 **Other**，否则 Vercel 可能覆盖 vercel.json 的配置。

### 步骤 4：先跳过环境变量，点击 Deploy

暂时不添加环境变量，先完成首次部署验证构建是否成功。

---

## 五、配置环境变量

首次部署成功后，添加环境变量：

### 步骤 1：进入设置

1. 在 Vercel Dashboard 中点击项目
2. 点击顶部 **Settings** 标签
3. 左侧选择 **Environment Variables**

### 步骤 2：添加变量

点击 **Add New**，逐个添加：

| 变量名 | 值 | Environments |
|--------|-----|-------------|
| `JWT_SECRET` | （见下方生成方法） | Production, Preview |
| `DEEPSEEK_API_KEY` | `sk-e24a6168ee374169b0341e6fdc053b64` | Production |

**生成 JWT_SECRET**（在本地终端运行）：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

复制输出的 64 位十六进制字符串，填入 `JWT_SECRET` 的值。

### 步骤 3：重新部署

1. 回到 **Deployments** 标签
2. 点击最新部署右侧的 **⋮** 按钮
3. 选择 **Redeploy**
4. 确认重新部署

---

## 六、验证部署

### 步骤 1：获取访问地址

部署完成后，Vercel 会分配一个地址，格式如：
```
https://intern-nav-system-你的用户名.vercel.app
```

### 步骤 2：测试功能

1. **打开网站** → 应该看到登录页面
2. **登录测试** → 使用默认账号 `hr@company.com / Admin@2024`
3. **API 健康检查** → 访问 `https://你的域名.vercel.app/api/health`
   - 应返回 `{"status":"ok"}`

### 步骤 3：自定义域名（可选）

1. Settings → Domains
2. 添加你的自定义域名
3. 按提示配置 DNS 记录

---

## 七、后续更新部署

每次推送代码到 GitHub，Vercel 会自动部署：

```bash
git add .
git commit -m "update: 修改说明"
git push
```

也可用 Vercel CLI 手动部署：

```bash
npm i -g vercel
cd c:\Users\32717\Desktop\demo设计\intern-nav-system
vercel --prod
```

---

## 八、常见问题排查

### Q1：构建失败 — `better-sqlite3` 编译错误

**原因**：C++ 原生模块在 Vercel 环境中编译失败。

**解决方案**：在 `vercel.json` 的 `functions` 中添加 `"runtime": "nodejs20.x"`，确保使用 Node 20。当前配置已包含，如仍有问题，可在 Vercel 项目 Settings → General → Node.js Version 中确认。

### Q2：API 返回 504 超时

**原因**：Serverless Function 执行时间超过限制。

**解决方案**：
- 免费版最长 10 秒，检查是否有耗时查询
- 升级 Vercel Pro 可获得 60 秒超时

### Q3：数据库数据丢失

**原因**：Vercel Serverless 的 `/tmp` 是临时存储，冷启动后会清空。

**解决方案**：
- 这是预期行为，每次冷启动会自动创建默认测试账号
- 生产环境请迁移到云数据库（Supabase / Neon / PlanetScale）

### Q4：页面刷新出现 404

**原因**：SPA 路由未被重写到 `index.html`。

**解决方案**：确认 `vercel.json` 中的 `rewrites` 配置存在（当前已配置）。

### Q5：CORS 错误

**原因**：跨域请求被阻止。

**解决方案**：当前 `backend/src/app.ts` 已配置允许 `.vercel.app` 域名。如使用自定义域名，需在 `allowedOrigins` 数组中添加。

---

## 九、已修改的文件清单

| 文件 | 变更 |
|------|------|
| `vercel.json` | **新建** — Vercel 构建配置、函数配置、SPA 路由重写 |
| `api/[[...path]].js` | **新建** — catch-all API 路由，替代 `api/index.js` |
| `api/index.js` | **删除** — 已被 `api/[[...path]].js` 替代 |
| `frontend/src/api.ts` | **修改** — 生产环境 API 地址改为相对路径 `/api` |
| `backend/src/app.ts` | **修改** — CORS 放宽，支持 `.vercel.app` 域名 |
| `package.json` | **修改** — 更新 `vercel-build` 脚本 |
| `.gitignore` | **修改** — 添加 `.vercel` 和 `*.db` |

---

## 十、快速命令汇总

```bash
# === 本地验证构建 ===
cd c:\Users\32717\Desktop\demo设计\intern-nav-system
npm install && cd backend && npm install && npx tsc && cd ../frontend && npm install && npx vite build && cd ..

# === 初始化并推送 Git ===
git init
git add .
git commit -m "feat: initial commit with Vercel config"
git remote add origin https://github.com/你的用户名/intern-nav-system.git
git branch -M main
git push -u origin main

# === 生成 JWT_SECRET ===
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# === Vercel CLI 部署（可选） ===
npm i -g vercel
vercel --prod
```
