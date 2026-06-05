import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

// ── GET /api/tasks ────────────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user?.id
  const role = req.user?.role
  const { assigned_to, department } = req.query

  let conditions: string[] = []
  let params: any[] = []

  if (role === 'intern') {
    conditions.push('t.assigned_to = ?')
    params.push(userId!)
  } else if (role === 'mentor') {
    conditions.push('(t.created_by = ? OR t.assigned_to = ?)')
    params.push(userId!, userId!)
    if (req.user?.department) {
      conditions.push('(t.department = ? OR t.department IS NULL)')
      params.push(req.user.department)
    }
  } else if (role === 'hr') {
    if (assigned_to && typeof assigned_to === 'string') {
      conditions.push('t.assigned_to = ?')
      params.push(assigned_to)
    }
    if (department && typeof department === 'string') {
      conditions.push('t.department = ?')
      params.push(department)
    }
  }

  let query = 'SELECT t.*, u.name as assigned_name, u.email as assigned_email FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id'
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY t.due_date IS NULL, t.due_date'

  const result = params.length > 0
    ? await db.prepare(query).all(...params)
    : await db.prepare(query).all()
  res.json(result)
})

// ── GET /api/tasks/stats ──────────────────────
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user?.id
  const role = req.user?.role

  let whereClause = ''
  let params: any[] = []

  if (role === 'intern') {
    whereClause = 'WHERE assigned_to = ?'
    params = [userId!]
  } else if (role === 'mentor') {
    whereClause = 'WHERE created_by = ? OR assigned_to = ?'
    params = [userId!, userId!]
  }

  const total = await db.prepare(`SELECT COUNT(*) as count FROM tasks ${whereClause}`).get(...(params as [any, ...any[]])) as any
  const inProgress = await db.prepare(
    `SELECT COUNT(*) as count FROM tasks ${whereClause ? whereClause + ' AND status = ?' : 'WHERE status = ?'}`
  ).get(...params, 'in_progress') as any
  const done = await db.prepare(
    `SELECT COUNT(*) as count FROM tasks ${whereClause ? whereClause + ' AND status = ?' : 'WHERE status = ?'}`
  ).get(...params, 'done') as any
  const overdue = await db.prepare(
    `SELECT COUNT(*) as count FROM tasks ${whereClause ? whereClause + ' AND status != ? AND due_date < NOW()' : 'WHERE status != ? AND due_date < NOW()'}`
  ).get(...params, 'done') as any
  const todo = await db.prepare(
    `SELECT COUNT(*) as count FROM tasks ${whereClause ? whereClause + ' AND status = ?' : 'WHERE status = ?'}`
  ).get(...params, 'todo') as any

  res.json({
    total: total.count,
    inProgress: inProgress.count,
    done: done.count,
    overdue: overdue.count,
    pending: todo.count,
  })
})

// ── POST /api/tasks ───────────────────────────
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const { id: userId, role, name: creatorName } = req.user!
  const { title, description, assignedTo, dueDate, priority } = req.body

  if (role !== 'mentor' && role !== 'hr' && role !== 'intern') {
    return res.status(403).json({ error: '无权创建任务' })
  }

  let finalAssignedTo = assignedTo
  if (role === 'intern') {
    if (assignedTo && assignedTo !== userId) {
      return res.status(403).json({ error: '实习生只能给自己创建待办任务' })
    }
    finalAssignedTo = userId
  }

  if (!title || !finalAssignedTo) {
    return res.status(400).json({ error: '缺少任务标题或负责人（assignedTo）' })
  }

  const assignedUser = await db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(finalAssignedTo) as any
  if (!assignedUser) {
    return res.status(400).json({ error: '指定的用户不存在' })
  }
  if (assignedUser.role !== 'intern') {
    return res.status(400).json({ error: '任务只能分配给实习生' })
  }

  const taskId = randomUUID()
  const taskPriority = priority || 'medium'
  const internDept = assignedUser.department || null

  await db.prepare(
    'INSERT INTO tasks (id, title, description, created_by, assigned_to, due_date, status, priority, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(taskId, title, description || '', userId, finalAssignedTo, dueDate || null, 'todo', taskPriority, internDept)

  if (role !== 'intern' || finalAssignedTo !== userId) {
    const notifyId = randomUUID()
    await db.prepare(
      "INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, FALSE, NOW())"
    ).run(
      notifyId, finalAssignedTo, 'task_assigned',
      `新任务：${title}`,
      `${creatorName} 为你分配了新任务「${title}」${dueDate ? `，截止日期 ${dueDate}` : ''}`
    )
  }

  const task = await db.prepare(
    'SELECT t.*, u.name as assigned_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.id = ?'
  ).get(taskId)

  res.status(201).json(task)
})

// ── PATCH /api/tasks/:id ──────────────────────
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ error: '任务不存在' })

  const { role, id: userId } = req.user!
  const isOwner = existing.created_by === userId
  const isAssignee = existing.assigned_to === userId
  const isHr = role === 'hr'

  if (role === 'intern') {
    if (!isAssignee) return res.status(403).json({ error: '无权操作此任务' })
    const { status } = req.body
    if (!status || !['todo', 'in_progress', 'done'].includes(status)) {
      return res.status(400).json({ error: '只能更新状态' })
    }
    await db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id)
  } else if (isOwner || isHr) {
    const { title, description, assignedTo, dueDate, status, priority } = req.body
    await db.prepare(
      'UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description), assigned_to = COALESCE(?, assigned_to), due_date = COALESCE(?, due_date), status = COALESCE(?, status), priority = COALESCE(?, priority) WHERE id = ?'
    ).run(
      title ?? null, description ?? null, assignedTo ?? null,
      dueDate !== undefined ? dueDate : null, status ?? null, priority ?? null, req.params.id
    )
  } else {
    return res.status(403).json({ error: '无权操作' })
  }

  const updated = await db.prepare(
    'SELECT t.*, u.name as assigned_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id WHERE t.id = ?'
  ).get(req.params.id)
  res.json(updated)
})

// ── DELETE /api/tasks/:id ─────────────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ error: '任务不存在' })

  if (existing.created_by !== req.user?.id && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '无权删除' })
  }

  await db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
