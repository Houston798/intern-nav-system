import bcrypt from 'bcryptjs'
import { db } from './db/index'
import { randomUUID } from 'crypto'

function seed() {
  try {
    const hrPassword = bcrypt.hashSync('Admin@2024', 10)
    const mentorPassword = bcrypt.hashSync('Mentor@2024', 10)
    const internPassword = bcrypt.hashSync('Intern@2024', 10)

    const hrId = randomUUID()
    const mentorId = randomUUID()
    const internId = randomUUID()

    // Insert or update users
    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(hrId, 'hr@company.com', hrPassword, 'HR Admin', 'hr', '人力资源')

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(mentorId, 'mentor@company.com', mentorPassword, '导师张工', 'mentor', '商务')

    db.prepare(
      'INSERT OR REPLACE INTO users (id, email, password_hash, name, role, department, mbti_type, has_experience, intern_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(internId, 'intern@company.com', internPassword, '实习生李四', 'intern', '商务', 'INTJ', 1, 'summer')

    // Insert invite keys
    const keys = [
      { key: 'MENTOR-123456', role: 'mentor' },
      { key: 'INTERN-123456', role: 'intern' },
      { key: 'HR-123456', role: 'hr' },
    ]

    for (const item of keys) {
      db.prepare(
        'INSERT OR IGNORE INTO invite_keys (id, key_value, role) VALUES (?, ?, ?)'
      ).run(randomUUID(), item.key, item.role)
    }

    // Insert skills
    db.prepare(
      'INSERT OR IGNORE INTO skills (id, name, department, description) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), '商务沟通', '商务', '学习客户沟通与合同谈判的基础技能。')

    db.prepare(
      'INSERT OR IGNORE INTO skills (id, name, department, description) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), '数据分析', '商务', '掌握数据统计、报告解读与业务洞察。')

    // Insert task
    db.prepare(
      'INSERT OR IGNORE INTO tasks (id, title, description, created_by, assigned_to, due_date, status, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), '完成入职问卷', '请完成 MBTI、部门和工作经历问卷。', mentorId, internId, '2026-06-05', 'in_progress', 'high')

    // Insert notification
    db.prepare(
      'INSERT OR IGNORE INTO notifications (id, user_id, type, title, content, is_read) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), internId, 'reminder', '欢迎加入商务部', '请完成第一步入职任务。', 0)

    // Insert onboarding progress
    db.prepare(
      'INSERT OR REPLACE INTO onboarding_progress (user_id, current_step, steps_data) VALUES (?, ?, ?)'
    ).run(internId, 2, JSON.stringify({ mbti: '已完成' }))

    console.log('✅ 种子数据已创建')
    console.log('HR 账号: hr@company.com / Admin@2024')
    console.log('导师账号: mentor@company.com / Mentor@2024')
    console.log('实习生账号: intern@company.com / Intern@2024')
    console.log('导师密钥: MENTOR-123456')
    console.log('实习生密钥: INTERN-123456')
    console.log('HR密钥: HR-123456')
  } catch (error) {
    console.error('❌ 初始化种子数据失败', error)
  } finally {
    db.close()
  }
}

seed()
