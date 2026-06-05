import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

router.get('/:skillId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const skillId = req.params.skillId

    const tasks = await db.prepare(
      `SELECT * FROM user_skill_tasks
       WHERE user_id = ? AND skill_id = ?
       ORDER BY order_index, created_at DESC`
    ).all(userId, skillId)

    res.json(tasks)
  } catch (err: any) {
    console.error('[user-skill-tasks GET] 错误:', err?.message || err)
    res.status(500).json({ error: '获取任务失败' })
  }
})

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const status = req.query.status as string | undefined

    let query = `SELECT ust.*, s.name as skill_name, s.department
                 FROM user_skill_tasks ust
                 JOIN skills s ON s.id = ust.skill_id
                 WHERE ust.user_id = ?`
    const params: any[] = [userId]

    if (status && ['pending','in_progress','completed'].includes(status)) {
      query += ' AND ust.status = ?'
      params.push(status)
    }

    query += ' ORDER BY ust.created_at DESC'
    const tasks = await db.prepare(query).all(...params)
    res.json(tasks)
  } catch (err: any) {
    console.error('[user-skill-tasks list] 错误:', err?.message || err)
    res.status(500).json({ error: '获取任务列表失败' })
  }
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const { skillId, title, description, due_date } = req.body

    if (!skillId || !title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: '技能节点和任务标题不能为空' })
    }

    const skill = await db.prepare('SELECT id, name, department FROM skills WHERE id = ?').get(skillId) as any
    if (!skill) return res.status(404).json({ error: '技能节点不存在' })

    const childCount = (await db.prepare(
      'SELECT COUNT(*) as cnt FROM skills WHERE parent_id = ?'
    ).get(skillId) as any)?.cnt || 0
    if (childCount > 0) {
      return res.status(400).json({ error: '请在具体技能子节点下创建任务，不能选分类标题' })
    }

    const maxOrder = (await db.prepare(
      'SELECT COALESCE(MAX(order_index), -1) as max_order FROM user_skill_tasks WHERE user_id = ? AND skill_id = ?'
    ).get(userId, skillId) as any)?.max_order ?? -1

    const id = randomUUID()
    await db.prepare(
      `INSERT INTO user_skill_tasks (id, user_id, skill_id, title, description, status, due_date, order_index)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
    ).run(id, userId, skillId, title.trim(), description || '', due_date || null, maxOrder + 1)

    const created = await db.prepare('SELECT * FROM user_skill_tasks WHERE id = ?').get(id)
    res.status(201).json({ ...created as any, skill_name: skill.name })
  } catch (err: any) {
    console.error('[user-skill-tasks POST] 错误:', err?.message || err)
    res.status(500).json({ error: `创建任务失败：${err?.message || '未知错误'}` })
  }
})

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const taskId = req.params.id

    const existing = await db.prepare(
      'SELECT * FROM user_skill_tasks WHERE id = ? AND user_id = ?'
    ).get(taskId, userId) as any
    if (!existing) return res.status(404).json({ error: '任务不存在' })

    const { title, description, status, due_date, order_index } = req.body
    const newTitle = title !== undefined ? title.trim() : existing.title
    const newDesc = description !== undefined ? description : existing.description
    const newStatus = status !== undefined ? status : existing.status
    const newDue = due_date !== undefined ? (due_date || null) : existing.due_date
    const newOrder = order_index !== undefined ? order_index : existing.order_index

    if (status && !['pending','in_progress','completed'].includes(status)) {
      return res.status(400).json({ error: '状态必须为 pending/in_progress/completed' })
    }

    await db.prepare(
      `UPDATE user_skill_tasks
       SET title=?, description=?, status=?, due_date=?, order_index=?, updated_at=NOW()
       WHERE id=? AND user_id=?`
    ).run(newTitle, newDesc, newStatus, newDue, newOrder, taskId, userId)

    const updated = await db.prepare('SELECT * FROM user_skill_tasks WHERE id = ?').get(taskId)
    res.json(updated)
  } catch (err: any) {
    console.error('[user-skill-tasks PUT] 错误:', err?.message || err)
    res.status(500).json({ error: `更新任务失败：${err?.message || '未知错误'}` })
  }
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id
    const taskId = req.params.id

    const existing = await db.prepare(
      'SELECT id FROM user_skill_tasks WHERE id = ? AND user_id = ?'
    ).get(taskId, userId)
    if (!existing) return res.status(404).json({ error: '任务不存在' })

    await db.prepare('DELETE FROM user_skill_tasks WHERE id = ? AND user_id = ?').run(taskId, userId)
    res.json({ success: true, id: taskId })
  } catch (err: any) {
    console.error('[user-skill-tasks DELETE] 错误:', err?.message || err)
    res.status(500).json({ error: `删除任务失败：${err?.message || '未知错误'}` })
  }
})

export default router
