// ═══════════════════════════════════════════════════════════
// Vercel Serverless Function — 实习生导航系统后端入口
// 使用 [[...path]] catch-all 路由，让 Express 处理所有 /api/* 请求
// ═══════════════════════════════════════════════════════════

// ── 环境变量（必须在导入数据库前设置） ──
process.env.DATABASE_PATH = '/tmp/intern_nav.db'
process.env.JWT_SECRET = process.env.JWT_SECRET || '8573e1b5db53b8a6fd6328d1e6020a8dabdde239c052e6db32434520c687fdc4'
process.env.NODE_ENV = 'production'

// ── 导入数据库（自动建表 + 种子技能数据） ──
const { db } = require('../backend/dist/db')

// ── 首次启动：种子默认用户与邀请密钥 ──
const bcrypt = require('bcryptjs')
const { randomUUID } = require('crypto')

try {
  const hrExists = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE role = ?').get('hr')
  if (!hrExists || hrExists.cnt === 0) {
    const hrPw = bcrypt.hashSync('Admin@2024', 10)
    const mentorPw = bcrypt.hashSync('Mentor@2024', 10)
    const internPw = bcrypt.hashSync('Intern@2024', 10)

    const hrId = randomUUID()
    const mentorId = randomUUID()
    const internId = randomUUID()

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department) VALUES (?,?,?,?,?,?)'
    ).run(hrId, 'hr@company.com', hrPw, 'HR Admin', 'hr', '人力资源')

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department) VALUES (?,?,?,?,?,?)'
    ).run(mentorId, 'mentor@company.com', mentorPw, '导师张工', 'mentor', '商务')

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department, mbti_type, has_experience, intern_type) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(internId, 'intern@company.com', internPw, '实习生李四', 'intern', '商务', 'INTJ', 1, 'summer')

    for (const [key, role] of [['MENTOR-123456', 'mentor'], ['INTERN-123456', 'intern'], ['HR-123456', 'hr']]) {
      db.prepare('INSERT OR IGNORE INTO invite_keys (id, key_value, role) VALUES (?,?,?)')
        .run(randomUUID(), key, role)
    }

    console.log('[Seed] Default users & invite keys created')
    console.log('  HR:      hr@company.com / Admin@2024')
    console.log('  Mentor:  mentor@company.com / Mentor@2024')
    console.log('  Intern:  intern@company.com / Intern@2024')
  }
} catch (err) {
  console.error('[Seed] Error:', err)
}

// ── 导出 Express 应用 ──
const app = require('../backend/dist/app').default
module.exports = app
