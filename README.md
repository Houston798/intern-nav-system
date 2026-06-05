# 实习生导航系统

业务部实习生导航系统 — 支持实习生/导师/HR 三角色使用闭环。

## 目录

- frontend/  React + Vite 前端
- backend/   Node.js + Express 后端（SQLite）
- docker-compose.yml  PostgreSQL + Redis（本地开发用）

---

## 🌐 CloudBase 云端部署（当前）

| 服务 | 地址 | 状态 |
|------|------|------|
| 前端静态托管 | [https://test-d6gc513wh1f79ab66-1436394535.tcloudbaseapp.com/](https://test-d6gc513wh1f79ab66-1436394535.tcloudbaseapp.com/?t=20260604v5) | ✅ |
| 后端 CloudRun | `https://intern-nav-backend-265908-8-1436394535.sh.run.tcloudbase.com` | ✅ |
| 环境 ID | `test-d6gc513wh1f79ab66` | ✅ |

> 最近部署：2026-06-04 v7 — 重构父节点功能：支持自定义输入父节点名称、自动创建、重名检测

### 测试账号

| 角色 | 邮箱 | 密码 |
|------|------|------|
| HR | hr@company.com | Admin@2024 |
| 导师 | 通过注册页面创建（需导师邀请密钥） | — |
| 实习生 | 通过注册页面创建（需实习生邀请密钥） | — |

### 管理控制台

- [CloudBase 总览](https://tcb.cloud.tencent.com/dev?envId=test-d6gc513wh1f79ab66#/overview)
- [CloudRun 服务](https://tcb.cloud.tencent.com/dev?envId=test-d6gc513wh1f79ab66#/platform-run)
- [静态托管](https://tcb.cloud.tencent.com/dev?envId=test-d6gc513wh1f79ab66#/static-hosting)
- [NoSQL 数据库](https://tcb.cloud.tencent.com/dev?envId=test-d6gc513wh1f79ab66#/db/doc)

---

## 本地开发

### 快速启动

1. 配置后端环境

```bash
cd backend
npm install
npm run dev
```

2. 配置前端环境

```bash
cd frontend
npm install
npm run dev
```

### 说明

- 前端默认运行在 `http://localhost:5173`，通过 vite proxy 连接本地后端
- 后端默认运行在 `http://localhost:3001`，使用 SQLite 数据库
- 首次启动会自动创建种子数据（HR 账号 + 邀请密钥）

---

## 云端部署更新

修改前端后重新部署：

```bash
cd frontend
npx vite build
# 通过 CloudBase 工具上传 dist/ 到静态托管
```
