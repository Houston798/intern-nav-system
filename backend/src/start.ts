// CloudRun 统一启动入口：先执行种子数据初始化，再启动 HTTP 服务
import dotenv from 'dotenv'
dotenv.config()

// 初始化数据库（建表 + 默认技能数据）
import { db, pool } from './db'
console.log('[Startup] Database ready')

// ── 种子数据（确保至少存在 HR/导师/实习生账号）──
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

try {
  const hrExists = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE role = ?').get('hr') as any
  if (hrExists.cnt === 0) {
    const hrPassword = bcrypt.hashSync('Admin@2024', 10)
    const mentorPassword = bcrypt.hashSync('Mentor@2024', 10)
    const internPassword = bcrypt.hashSync('Intern@2024', 10)

    const hrId = randomUUID()
    const mentorId = randomUUID()
    const internId = randomUUID()

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(hrId, 'hr@company.com', hrPassword, 'HR Admin', 'hr', '人力资源')

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(mentorId, 'mentor@company.com', mentorPassword, '导师张工', 'mentor', '商务')

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department, mbti_type, has_experience, intern_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(internId, 'intern@company.com', internPassword, '实习生李四', 'intern', '商务', 'INTJ', 1, 'summer')

    // 插入邀请密钥
    const keys = [
      { key: 'MENTOR-123456', role: 'mentor' },
      { key: 'INTERN-123456', role: 'intern' },
      { key: 'HR-123456', role: 'hr' },
    ]
    for (const item of keys) {
      db.prepare('INSERT OR IGNORE INTO invite_keys (id, key_value, role) VALUES (?, ?, ?)')
        .run(randomUUID(), item.key, item.role)
    }

    // 插入示例任务
    db.prepare(
      'INSERT OR IGNORE INTO tasks (id, title, description, created_by, assigned_to, due_date, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), '完成入职问卷', '请完成 MBTI、部门和工作经历问卷。', mentorId, internId, '2026-06-05', 'in_progress', 'high')

    // 插入 example 通知
    db.prepare(
      'INSERT OR IGNORE INTO notifications (id, user_id, type, title, content, is_read) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), internId, 'reminder', '欢迎加入商务部', '请完成第一步入职任务。', 0)

    // 插入 onboarding 进度
    db.prepare(
      'INSERT OR REPLACE INTO onboarding_progress (user_id, current_step, steps_data) VALUES (?, ?, ?)'
    ).run(internId, 2, JSON.stringify({ mbti: '已完成' }))

    console.log('[Startup] Seed data created')
    console.log('  HR: hr@company.com / Admin@2024')
    console.log('  Mentor: mentor@company.com / Mentor@2024')
    console.log('  Intern: intern@company.com / Intern@2024')
  } else {
    console.log('[Startup] Seed data already exists, skipping')
  }
} catch (err) {
  console.error('[Startup] Seed error:', err)
}

// ── 启动 Express 服务 ──
import app from './app'
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`)
})
