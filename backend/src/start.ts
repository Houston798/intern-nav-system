// CloudRun / 本地开发统一启动入口
import dotenv from 'dotenv'
dotenv.config()

// 验证数据库连接
import { db } from './db'

async function start() {
  try {
    // 测试数据库连接
    const result = await db.prepare('SELECT 1 as ok').get() as any
    if (result?.ok === 1) {
      console.log('[Startup] Database connected (Supabase PostgreSQL)')
    }
  } catch (err) {
    console.error('[Startup] Database connection failed:', err)
    process.exit(1)
  }

  // ── 启动 Express 服务 ──
  const app = (await import('./app')).default
  const PORT = process.env.PORT || 3001
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`)
  })

  // 提示种子数据说明
  console.log('[Startup] 种子数据请通过 Supabase SQL Editor 执行:')
  console.log('  1. supabase/schema.sql — 建表')
  console.log('  2. supabase/seed.sql   — 种子数据(邀请密钥+技能树)')
}

start()
