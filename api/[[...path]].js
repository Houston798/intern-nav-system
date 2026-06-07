// ═══════════════════════════════════════════════════════════
// Vercel Serverless Function — 实习生导航系统后端入口
// ═══════════════════════════════════════════════════════════

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = '8573e1b5db53b8a6fd6328d1e6020a8dabdde239c052e6db32434520c687fdc4'
}
process.env.NODE_ENV = 'production'
process.env.VERCEL = '1'

let app
let loadError = null
try {
  app = require('./dist/app').default
} catch (e) {
  loadError = e
}

module.exports = (req, res) => {
  if (loadError) {
    return res.status(500).json({
      error: 'Failed to load Express app',
      detail: loadError.message,
      stack: loadError.stack?.split('\n').slice(0, 5)
    })
  }

  // Vercel catch-all 路由: req.url 可能是以下格式之一:
  //   /auth/register        (去掉 /api 前缀)
  //   /api/auth/register    (保留完整路径)
  // 统一去掉 /api 前缀，因为 Express 在 VERCEL 模式下不挂 /api 前缀
  if (req.url.startsWith('/api/')) {
    req.url = req.url.slice(4) // 去掉 /api → /auth/register
  } else if (req.url === '/api') {
    req.url = '/'
  }

  return app(req, res)
}
