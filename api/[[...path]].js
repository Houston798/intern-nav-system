// ═══════════════════════════════════════════════════════════
// Vercel Serverless Function — 实习生导航系统后端入口
// ═══════════════════════════════════════════════════════════

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = '8573e1b5db53b8a6fd6328d1e6020a8dabdde239c052e6db32434520c687fdc4'
}
process.env.NODE_ENV = 'production'

let app
let loadError = null
try {
  app = require('./dist/app').default
} catch (e) {
  loadError = e
}

module.exports = (req, res) => {
  // 调试：记录原始请求
  console.log(`[API] ${req.method} ${req.url} headers=${JSON.stringify(req.headers)}`)

  if (loadError) {
    return res.status(500).json({
      error: 'Failed to load Express app',
      detail: loadError.message,
      stack: loadError.stack?.split('\n').slice(0, 5)
    })
  }

  // 补回 /api 前缀
  const originalUrl = req.url
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url
  }
  console.log(`[API] rewritten: ${originalUrl} → ${req.url}`)

  // 注入调试中间件
  req._debugOriginalUrl = originalUrl

  return app(req, res)
}
