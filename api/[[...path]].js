// ═══════════════════════════════════════════════════════════
// Vercel Serverless Function — 实习生导航系统后端入口
// ═══════════════════════════════════════════════════════════

// ── 环境变量 ──
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = '8573e1b5db53b8a6fd6328d1e6020a8dabdde239c052e6db32434520c687fdc4'
}
process.env.NODE_ENV = 'production'

// ── 加载 Express 应用 ──
let app
try {
  app = require('./dist/app').default
} catch (e) {
  // 如果 dist 不存在，返回错误信息帮助调试
  module.exports = (req, res) => {
    res.status(500).json({ 
      error: 'Failed to load Express app', 
      detail: e.message,
      url: req.url,
      cwd: process.cwd(),
      files: require('fs').readdirSync('./').join(', ')
    })
  }
  return
}

module.exports = (req, res) => {
  // Vercel catch-all 路由会去掉 /api 前缀，需要补回
  const originalUrl = req.url
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url
  }
  console.log(`[API] ${req.method} original=${originalUrl} rewritten=${req.url}`)
  return app(req, res)
}
