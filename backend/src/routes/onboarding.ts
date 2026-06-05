import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'

const router = Router()

// ── 获取入职进度 ──
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const result = db.prepare(
    'SELECT current_step, steps_data, completed_at FROM onboarding_progress WHERE user_id = ?'
  ).get(userId) as any
  if (!result) {
    return res.json({ current_step: 1, steps_data: {}, completed_at: null })
  }
  res.json({
    ...result,
    steps_data: typeof result.steps_data === 'string' ? JSON.parse(result.steps_data) : result.steps_data,
  })
})

// ── 通用进度更新 ──
router.post('/step', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const { currentStep, stepsData, completedAt } = req.body
  if (!userId || typeof currentStep !== 'number') {
    return res.status(400).json({ error: '参数错误' })
  }
  db.prepare(
    `INSERT INTO onboarding_progress (user_id, current_step, steps_data, completed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET current_step=EXCLUDED.current_step, steps_data=EXCLUDED.steps_data, completed_at=EXCLUDED.completed_at`
  ).run(userId, currentStep, JSON.stringify(stepsData || {}), completedAt || null)

  res.json({ success: true })
})

// ── Step 2: MBTI 测评 ──
router.post('/mbti', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const { mbti_type, answers } = req.body
  if (!userId || !mbti_type) {
    return res.status(400).json({ error: '缺少 MBTI 类型' })
  }

  // 更新用户 MBTI
  db.prepare('UPDATE users SET mbti_type = ? WHERE id = ?').run(mbti_type, userId)

  // 更新入职进度
  const existing = db.prepare('SELECT steps_data FROM onboarding_progress WHERE user_id = ?').get(userId) as any
  const stepsData = existing ? { ...JSON.parse(existing.steps_data || '{}'), mbti: { type: mbti_type, answers } } : { mbti: { type: mbti_type, answers } }
  
  db.prepare(
    `INSERT INTO onboarding_progress (user_id, current_step, steps_data) VALUES (?, 3, ?)
     ON CONFLICT (user_id) DO UPDATE SET current_step=MAX(onboarding_progress.current_step, 3), steps_data=?`
  ).run(userId, JSON.stringify(stepsData), JSON.stringify(stepsData))

  res.json({ success: true, mbti_type, next_step: 3 })
})

// ── Step 3: 部门选择 ──
router.post('/department', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const { department, sub_direction } = req.body
  if (!userId || !department) {
    return res.status(400).json({ error: '缺少部门信息' })
  }

  db.prepare('UPDATE users SET department = ? WHERE id = ?').run(department, userId)

  const existing = db.prepare('SELECT steps_data FROM onboarding_progress WHERE user_id = ?').get(userId) as any
  const stepsData = existing ? { ...JSON.parse(existing.steps_data || '{}'), department: { name: department, direction: sub_direction || '' } } : { department: { name: department, direction: sub_direction || '' } }

  db.prepare(
    `INSERT INTO onboarding_progress (user_id, current_step, steps_data) VALUES (?, 4, ?)
     ON CONFLICT (user_id) DO UPDATE SET current_step=MAX(onboarding_progress.current_step, 4), steps_data=?`
  ).run(userId, JSON.stringify(stepsData), JSON.stringify(stepsData))

  res.json({ success: true, department, next_step: 4 })
})

// ── Step 4: 获取导师列表 ──
router.get('/mentors', authMiddleware, (req: AuthRequest, res) => {
  const mentors = db.prepare(
    "SELECT id, name, email, department, mbti_type FROM users WHERE role = 'mentor'"
  ).all() as any[]
  res.json({ mentors })
})

// ── Step 4: 选择导师 ──
router.post('/mentor', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const { mentor_id } = req.body
  if (!userId || !mentor_id) {
    return res.status(400).json({ error: '缺少导师 ID' })
  }

  // 验证导师存在
  const mentor = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'mentor'").get(mentor_id) as any
  if (!mentor) {
    return res.status(404).json({ error: '导师不存在' })
  }

  // 把该实习生的 mentor_id 存到 users 表或单独表（这里简化：存到 steps_data）
  const existing = db.prepare('SELECT steps_data FROM onboarding_progress WHERE user_id = ?').get(userId) as any
  const stepsData = existing ? { ...JSON.parse(existing.steps_data || '{}'), mentor: { id: mentor_id, name: mentor.name } } : { mentor: { id: mentor_id, name: mentor.name } }

  db.prepare(
    `INSERT INTO onboarding_progress (user_id, current_step, steps_data) VALUES (?, 5, ?)
     ON CONFLICT (user_id) DO UPDATE SET current_step=MAX(onboarding_progress.current_step, 5), steps_data=?`
  ).run(userId, JSON.stringify(stepsData), JSON.stringify(stepsData))

  res.json({ success: true, mentor: { id: mentor_id, name: mentor.name }, next_step: 5 })
})

// ── Step 5: 目标设定 ──
router.post('/goals', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const { goals } = req.body
  if (!userId || !goals || !Array.isArray(goals)) {
    return res.status(400).json({ error: '缺少目标列表' })
  }

  const existing = db.prepare('SELECT steps_data FROM onboarding_progress WHERE user_id = ?').get(userId) as any
  const stepsData = existing ? { ...JSON.parse(existing.steps_data || '{}'), goals } : { goals }

  db.prepare(
    `INSERT INTO onboarding_progress (user_id, current_step, steps_data) VALUES (?, 6, ?)
     ON CONFLICT (user_id) DO UPDATE SET current_step=MAX(onboarding_progress.current_step, 6), steps_data=?`
  ).run(userId, JSON.stringify(stepsData), JSON.stringify(stepsData))

  res.json({ success: true, goals, next_step: 6 })
})

// ── Step 6: 入职培训完成 ──
router.post('/training', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const { quiz_score } = req.body
  if (!userId) {
    return res.status(400).json({ error: '缺少用户信息' })
  }

  const existing = db.prepare('SELECT steps_data FROM onboarding_progress WHERE user_id = ?').get(userId) as any
  const stepsData = existing ? { ...JSON.parse(existing.steps_data || '{}'), training: { quiz_score, completed_at: new Date().toISOString() } } : { training: { quiz_score, completed_at: new Date().toISOString() } }

  db.prepare(
    `INSERT INTO onboarding_progress (user_id, current_step, steps_data, completed_at) VALUES (?, 7, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET current_step=7, steps_data=?, completed_at=?`
  ).run(userId, JSON.stringify(stepsData), new Date().toISOString(), JSON.stringify(stepsData), new Date().toISOString())

  res.json({ success: true, all_done: true })
})

export default router
