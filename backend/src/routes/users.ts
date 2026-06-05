import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

const router = Router()

// ── 用户查询列 ─────────────────────────────────
const USER_COLS = `id, email, name, role, department, mbti_type,
  intern_type, has_experience, avatar_url,
  intern_start_date, intern_end_date, mentor_id,
  on_leave, created_at, updated_at`

// ── GET /api/users/me ──────────────────────────
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) return res.status(401).json({ error: '未授权' })

  const user = await db.prepare(
    `SELECT ${USER_COLS} FROM users WHERE id = ?`
  ).get(userId)

  if (!user) return res.status(404).json({ error: '用户未找到' })
  res.json(user)
})

// ── GET /api/users/stats ──────────────────────
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  const { role } = req.user!

  const total = await db.prepare('SELECT COUNT(*) as count FROM users').get() as any

  const byRole = await db.prepare(
    "SELECT role, COUNT(*) as count FROM users GROUP BY role"
  ).all() as any[]

  const byDept = await db.prepare(
    "SELECT department, COUNT(*) as count FROM users WHERE department IS NOT NULL AND department != '' GROUP BY department"
  ).all() as any[]

  const weeklyNew = await db.prepare(
    "SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
  ).get() as any

  const todayNew = await db.prepare(
    "SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE"
  ).get() as any

  let inviteStats: any = null
  if (role === 'hr') {
    const totalKeys = await db.prepare('SELECT COUNT(*) as count FROM invite_keys').get() as any
    const usedKeys = await db.prepare('SELECT COUNT(*) as count FROM invite_keys WHERE used_by IS NOT NULL').get() as any
    inviteStats = {
      total: totalKeys.count,
      used: usedKeys.count,
      available: totalKeys.count - usedKeys.count,
    }
  }

  let myInterns = 0
  if (role === 'mentor') {
    const row = await db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'intern'"
    ).get() as any
    myInterns = row.count
  }

  res.json({
    total: total.count,
    byRole: Object.fromEntries(byRole.map((r: any) => [r.role, r.count])),
    byDept,
    weeklyNew: weeklyNew.count,
    todayNew: todayNew.count,
    myInterns,
    inviteStats,
  })
})

// ── GET /api/users ────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const { role } = req.user!
  const { filter, department } = req.query

  let conditions: string[] = []
  let params: any[] = []

  if (role === 'intern') {
    return res.status(403).json({ error: '实习生无权查看用户列表' })
  }

  if (role === 'mentor') {
    if (filter === 'intern' || !filter) {
      conditions.push("role = 'intern'")
    }
    if (req.user?.department) {
      conditions.push("department = ?")
      params.push(req.user.department)
    }
  } else if (role === 'hr') {
    if (filter && filter !== 'all') {
      conditions.push('role = ?')
      params.push(filter as string)
    }
    if (department) {
      conditions.push('department = ?')
      params.push(department as string)
    }
  }

  let query = `SELECT ${USER_COLS} FROM users`
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY name'

  const result = params.length > 0
    ? await db.prepare(query).all(...params)
    : await db.prepare(query).all()
  res.json(result)
})

// ── GET /api/users/departments ────────────────
router.get('/departments', authMiddleware, async (_req, res) => {
  const depts = await db.prepare(
    "SELECT department, COUNT(*) as count FROM users WHERE department IS NOT NULL AND department != '' GROUP BY department"
  ).all()
  res.json(depts)
})

// ── GET /api/users/mentors ─────────────────────
router.get('/mentors', authMiddleware, async (req: AuthRequest, res) => {
  const { role } = req.user!
  if (role === 'intern') {
    return res.status(403).json({ error: '实习生无权查看导师列表' })
  }

  const { department } = req.query
  let query = `SELECT ${USER_COLS} FROM users WHERE role = 'mentor'`
  let params: any[] = []

  if (department) {
    query += ' AND department = ?'
    params.push(department as string)
  } else if (role === 'mentor' && req.user?.department) {
    query += ' AND department = ?'
    params.push(req.user.department)
  }

  query += ' ORDER BY name'
  const result = params.length > 0
    ? await db.prepare(query).all(...params)
    : await db.prepare(query).all()
  res.json(result)
})

// ── GET /api/users/unassigned-interns ──────────
router.get('/unassigned-interns', authMiddleware, async (req: AuthRequest, res) => {
  const { role } = req.user!
  if (role !== 'hr' && role !== 'mentor') {
    return res.status(403).json({ error: '无权查看' })
  }

  const { department } = req.query
  let conditions = ["role = 'intern'", "(mentor_id IS NULL OR mentor_id = '')"]
  let params: any[] = []

  if (department) {
    conditions.push('department = ?')
    params.push(department as string)
  } else if (role === 'mentor' && req.user?.department) {
    conditions.push('department = ?')
    params.push(req.user.department)
  }

  const query = `SELECT ${USER_COLS} FROM users WHERE ${conditions.join(' AND ')} ORDER BY name`
  const result = params.length > 0
    ? await db.prepare(query).all(...params)
    : await db.prepare(query).all()
  res.json(result)
})

// ── PUT /api/users/:id/bind-mentor ─────────────
router.put('/:id/bind-mentor', authMiddleware, async (req: AuthRequest, res) => {
  const { role } = req.user!
  if (role !== 'hr' && role !== 'mentor') {
    return res.status(403).json({ error: '无权操作' })
  }

  const internId = req.params.id
  const { mentorId } = req.body

  let targetMentorId: string
  if (role === 'hr') {
    if (!mentorId) return res.status(400).json({ error: '请指定导师ID' })
    targetMentorId = mentorId
  } else {
    targetMentorId = req.user!.id
  }

  const intern = await db.prepare('SELECT id, name, role, department FROM users WHERE id = ?').get(internId) as any
  if (!intern) return res.status(404).json({ error: '实习生不存在' })
  if (intern.role !== 'intern') return res.status(400).json({ error: '该用户不是实习生' })

  const mentor = await db.prepare('SELECT id, name, role, department FROM users WHERE id = ? AND role = ?').get(targetMentorId, 'mentor') as any
  if (!mentor) return res.status(404).json({ error: '导师不存在' })
  if (mentor.department && intern.department && mentor.department !== intern.department) {
    return res.status(400).json({ error: `导师所属部门(${mentor.department})与实习生部门(${intern.department})不一致` })
  }

  await db.prepare("UPDATE users SET mentor_id = ?, updated_at = NOW() WHERE id = ?").run(targetMentorId, internId)

  res.json({ success: true, message: `已将实习生「${intern.name}」分配给导师「${mentor.name}」` })
})

// ── PUT /api/users/:id ─────────────────────────
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { role } = req.user!
    const targetId = req.params.id

    const target = await db.prepare(
      `SELECT id, role, name FROM users WHERE id = ?`
    ).get(targetId) as any

    if (!target) {
      return res.status(404).json({ error: '用户不存在' })
    }

    if (role === 'intern') {
      return res.status(403).json({ error: '实习生无权修改用户信息' })
    }

    if (role === 'mentor') {
      if (target.role !== 'intern') {
        return res.status(403).json({ error: '导师仅能修改实习生信息' })
      }
      const allowed = ['internStartDate', 'internEndDate']
      const bodyKeys = Object.keys(req.body)
      const disallowed = bodyKeys.filter(k => !allowed.includes(k) && k !== 'intern_start_date' && k !== 'intern_end_date')
      if (disallowed.length > 0) {
        return res.status(403).json({ error: `导师仅能修改实习时间，不能修改: ${disallowed.join(', ')}` })
      }
    }

    const updates: string[] = []
    const values: any[] = []

    if (role === 'hr') {
      if (req.body.name !== undefined) {
        const n = String(req.body.name).trim()
        if (!n || n.length > 64 || /[<>{}]/.test(n)) {
          return res.status(400).json({ error: '姓名格式不正确' })
        }
        updates.push('name = ?')
        values.push(n)
      }
      if (req.body.email !== undefined) {
        const em = String(req.body.email).trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          return res.status(400).json({ error: '邮箱格式不正确' })
        }
        const dup = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(em, targetId) as any
        if (dup) {
          return res.status(409).json({ error: '该邮箱已被其他用户使用' })
        }
        updates.push('email = ?')
        values.push(em)
      }
      if (req.body.department !== undefined) {
        const dept = req.body.department ? String(req.body.department).trim() : null
        updates.push('department = ?')
        values.push(dept)
      }
      if (req.body.mbti_type !== undefined) {
        updates.push('mbti_type = ?')
        values.push(req.body.mbti_type || null)
      }
      if (req.body.intern_type !== undefined) {
        const it = req.body.intern_type
        if (it && !['summer', 'regular'].includes(it)) {
          return res.status(400).json({ error: '实习类型只能是 summer 或 regular' })
        }
        updates.push('intern_type = ?')
        values.push(it || null)
      }
    }

    if (req.body.intern_start_date !== undefined || req.body.internStartDate !== undefined) {
      const start = (req.body.intern_start_date || req.body.internStartDate || '').trim()
      if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
        return res.status(400).json({ error: '实习开始日期格式不正确（YYYY-MM-DD）' })
      }
      if (start && isNaN(new Date(start + 'T00:00:00Z').getTime())) {
        return res.status(400).json({ error: '实习开始日期不是有效日期' })
      }
      updates.push('intern_start_date = ?')
      values.push(start || null)
    }
    if (req.body.intern_end_date !== undefined || req.body.internEndDate !== undefined) {
      const end = (req.body.intern_end_date || req.body.internEndDate || '').trim()
      if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return res.status(400).json({ error: '实习结束日期格式不正确（YYYY-MM-DD）' })
      }
      if (end && isNaN(new Date(end + 'T00:00:00Z').getTime())) {
        return res.status(400).json({ error: '实习结束日期不是有效日期' })
      }
      updates.push('intern_end_date = ?')
      values.push(end || null)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' })
    }

    updates.push("updated_at = NOW()")
    values.push(targetId)

    await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = await db.prepare(
      `SELECT ${USER_COLS} FROM users WHERE id = ?`
    ).get(targetId)

    res.json({ success: true, user: updated })
  } catch (error: any) {
    console.error('[Update User Error]', error)
    if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
      return res.status(409).json({ error: '邮箱已被使用' })
    }
    return res.status(500).json({ error: '服务器内部错误' })
  }
})

// ── DELETE /api/users/:id ──────────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { role, id: selfId } = req.user!

    if (role !== 'hr') {
      return res.status(403).json({ error: '仅 HR 可删除用户' })
    }

    const targetId = req.params.id

    if (targetId === selfId) {
      return res.status(400).json({ error: '不能删除自己的账户' })
    }

    const target = await db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(targetId) as any
    if (!target) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const transaction = db.transaction(async () => {
      await db.prepare('UPDATE invite_keys SET used_by = NULL, used_at = NULL WHERE used_by = ?').run(targetId)
      await db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(targetId)
      await db.prepare('UPDATE tasks SET created_by = NULL WHERE created_by = ?').run(targetId)
      await db.prepare('DELETE FROM tasks WHERE assigned_to = ?').run(targetId)
      await db.prepare('DELETE FROM onboarding_progress WHERE user_id = ?').run(targetId)
      await db.prepare('DELETE FROM ai_conversations WHERE user_id = ?').run(targetId)
      await db.prepare('DELETE FROM notifications WHERE user_id = ?').run(targetId)
      await db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?').run(targetId, targetId)
      if (target.role === 'mentor') {
        await db.prepare('UPDATE users SET mentor_id = NULL WHERE mentor_id = ?').run(targetId)
      }
      await db.prepare('DELETE FROM users WHERE id = ?').run(targetId)
    })

    await transaction()

    console.log(`[User Deleted] ${target.name} (${target.role}) deleted by HR`)
    res.json({
      success: true,
      message: `已删除用户「${target.name}」及其所有关联数据`,
      deleted: { id: targetId, name: target.name, role: target.role },
    })
  } catch (error: any) {
    console.error('[Delete User Error]', error)
    return res.status(500).json({ error: '删除用户失败' })
  }
})

export default router
