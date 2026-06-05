// ═══════════════════════════════════════════════════════════
// Vercel Serverless Function — 实习生导航系统后端入口
// 使用 [[...path]] catch-all 路由，让 Express 处理所有 /api/* 请求
// 数据库：Supabase PostgreSQL（通过 DATABASE_URL 环境变量连接）
// ═══════════════════════════════════════════════════════════

// ── 环境变量（必须在导入数据库前设置） ──
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = '8573e1b5db53b8a6fd6328d1e6020a8dabdde239c052e6db32434520c687fdc4'
}
process.env.NODE_ENV = 'production'

// ── 加载 Express 应用 ──
const app = require('../backend/dist/app').default

// Vercel catch-all 路由会去掉 /api 前缀，需要补回
module.exports = (req, res) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url
  }
  return app(req, res)
}
