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

// ── 导出 Express 应用 ──
// Vercel 会把 /api/xxx 请求路由到本函数，但 req.url 会去掉 /api 前缀
// 例如请求 /api/auth/register → req.url = /auth/register
// 而 Express 路由挂载在 /api/auth，所以需要补回 /api 前缀
const app = require('./backend-dist/app').default

module.exports = (req, res) => {
  // 补回 /api 前缀，让 Express 路由能正确匹配
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url
  }
  return app(req, res)
}
