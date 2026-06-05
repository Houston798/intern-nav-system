import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

type MentorTaskRow = {
  id: string
  intern_id: string
  mentor_id: string
  title: string
  description: string
  category: 'basic' | 'department' | 'advanced'
  status: 'locked' | 'in_progress' | 'mastered'
  due_date: string | null
  order_index: number
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════════════
//  GET /api/mentor-tasks/:internId
//  获取某个实习生的所有自定义任务
// ═══════════════════════════════════════════════════
router.get('/:internId', authMiddleware, (req: AuthRequest, res: Response) => {
  const internId = req.params.internId
  const userId = req.user?.id
  const role = req.user?.role

  // 权限：实习生只能看自己的，导师只能看自己负责的，HR 可看全部
  if (role === 'intern' && userId !== internId) {
    return res.status(403).json({ error: '只能查看自己的任务' })
  }

  const intern = db.prepare('SELECT id, mentor_id FROM users WHERE id = ? AND role = ?').get(internId, 'intern') as any
  if (!intern) return res.status(404).json({ error: '实习生不存在' })

  if (role === 'mentor' && intern.mentor_id !== userId) {
    return res.status(403).json({ error: '仅可查看自己负责的实习生' })
  }

  const tasks = db.prepare(
    `SELECT mt.*, u.name as mentor_name
     FROM mentor_tasks mt
     LEFT JOIN users u ON u.id = mt.mentor_id
     WHERE mt.intern_id = ?
     ORDER BY mt.order_index, mt.created_at DESC`
  ).all(internId) as (MentorTaskRow & { mentor_name?: string })[]

  res.json(tasks)
})

// ═══════════════════════════════════════════════════
//  POST /api/mentor-tasks
//  创建自定义任务（仅导师/HR）
// ═══════════════════════════════════════════════════
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可创建任务' })
  }

  const { internId, title, description, category, due_date, order_index } = req.body
  if (!internId || !title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: '实习生ID和任务标题不能为空' })
  }
  if (title.trim().length > 128) {
    return res.status(400).json({ error: '任务标题不能超过128个字符' })
  }

  // 验证实习生存在
  const intern = db.prepare('SELECT id, mentor_id, department FROM users WHERE id = ? AND role = ?').get(internId, 'intern') as any
  if (!intern) return res.status(404).json({ error: '实习生不存在' })

  // 导师只能为自己负责的实习生创建任务，且部门必须匹配
  if (req.user?.role === 'mentor') {
    if (intern.mentor_id !== req.user?.id) {
      return res.status(403).json({ error: '仅可为自己负责的实习生创建任务' })
    }
    // 导师必须与实习生同部门
    if (req.user?.department && intern.department && req.user.department !== intern.department) {
      return res.status(403).json({ error: `无法为其他部门的实习生(${intern.department})创建任务` })
    }
  }

  const cat = ['basic', 'department', 'advanced'].includes(category) ? category : 'department'
  const id = randomUUID()
  const orderIdx = typeof order_index === 'number' ? order_index : 0
  const taskDept = intern.department || null

  db.prepare(
    `INSERT INTO mentor_tasks (id, intern_id, mentor_id, title, description, category, department, status, due_date, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'locked', ?, ?)`
  ).run(id, internId, req.user!.id, title.trim(), description || '', cat, taskDept, due_date || null, orderIdx)

  const created = db.prepare('SELECT * FROM mentor_tasks WHERE id = ?').get(id) as MentorTaskRow
  res.status(201).json(created)
})

// ═══════════════════════════════════════════════════
//  PUT /api/mentor-tasks/:id
//  更新自定义任务
// ═══════════════════════════════════════════════════
router.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM mentor_tasks WHERE id = ?').get(req.params.id) as MentorTaskRow
  if (!existing) return res.status(404).json({ error: '任务不存在' })

  const userId = req.user?.id
  const role = req.user?.role

  // 权限：创建者或 HR
  if (role !== 'hr' && existing.mentor_id !== userId) {
    // 实习生可以更新自己任务的 status
    if (role === 'intern' && existing.intern_id === userId) {
      const { status } = req.body
      if (!status || !['locked', 'in_progress', 'mastered'].includes(status)) {
        return res.status(400).json({ error: '状态只能为 locked/in_progress/mastered' })
      }
      db.prepare(
        "UPDATE mentor_tasks SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(status, req.params.id)

      const updated = db.prepare('SELECT * FROM mentor_tasks WHERE id = ?').get(req.params.id)
      return res.json(updated)
    }
    return res.status(403).json({ error: '无权修改此任务' })
  }

  const { title, description, category, status, due_date, order_index } = req.body
  if (title !== undefined && (!title || typeof title !== 'string' || !title.trim())) {
    return res.status(400).json({ error: '任务标题不能为空' })
  }
  if (title && title.trim().length > 128) {
    return res.status(400).json({ error: '任务标题不能超过128个字符' })
  }

  db.prepare(
    `UPDATE mentor_tasks SET
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       category = COALESCE(?, category),
       status = COALESCE(?, status),
       due_date = COALESCE(?, due_date),
       order_index = COALESCE(?, order_index),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title?.trim() ?? null,
    description ?? null,
    ['basic', 'department', 'advanced'].includes(category) ? category : null,
    ['locked', 'in_progress', 'mastered'].includes(status) ? status : null,
    due_date !== undefined ? due_date : undefined,
    typeof order_index === 'number' ? order_index : null,
    req.params.id,
  )

  const updated = db.prepare('SELECT * FROM mentor_tasks WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// ═══════════════════════════════════════════════════
//  DELETE /api/mentor-tasks/:id
//  删除自定义任务
// ═══════════════════════════════════════════════════
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const existing = db.prepare('SELECT * FROM mentor_tasks WHERE id = ?').get(req.params.id) as MentorTaskRow
  if (!existing) return res.status(404).json({ error: '任务不存在' })

  // 权限：创建者自己的任务或 HR 可删除
  if (existing.mentor_id !== req.user?.id && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '无权删除此任务' })
  }

  db.prepare('DELETE FROM mentor_tasks WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
