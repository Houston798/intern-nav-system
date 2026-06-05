import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

type DeptTaskRow = {
  id: string
  title: string
  description: string
  department: string
  category: 'basic' | 'department' | 'advanced'
  skill_source_id: string | null
  created_by: string
  due_date: string | null
  status: 'active' | 'archived'
  order_index: number
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════════════
//  GET /api/department-tasks
//  按部门获取共享任务 — 同部门实习生可见全部
// ═══════════════════════════════════════════════════
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { role, department: userDept, id: userId } = req.user!
  const { department, status } = req.query

  let conditions: string[] = []
  let params: any[] = []

  if (role === 'intern') {
    // 实习生只能看自己部门的任务
    if (!userDept) return res.json([])
    conditions.push('dt.department = ?')
    params.push(userDept)
    conditions.push("dt.status = 'active'")
  } else if (role === 'mentor') {
    // 导师看自己部门的（包括已归档）
    if (!userDept && !department) return res.json([])
    if (department) {
      conditions.push('dt.department = ?')
      params.push(department as string)
    } else {
      conditions.push('dt.department = ?')
      params.push(userDept)
    }
    if (status && status === 'archived') {
      conditions.push("dt.status = 'archived'")
    } else if (!status) {
      conditions.push("dt.status = 'active'")
    }
  } else if (role === 'hr') {
    if (department) {
      conditions.push('dt.department = ?')
      params.push(department as string)
    }
    if (status) {
      conditions.push('dt.status = ?')
      params.push(status as string)
    }
  }

  let query = `SELECT dt.*, u.name as creator_name
    FROM department_tasks dt
    LEFT JOIN users u ON u.id = dt.created_by`

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY dt.order_index, dt.created_at DESC'

  const result = params.length > 0
    ? db.prepare(query).all(...params)
    : db.prepare(query).all()
  res.json(result)
})

// ═══════════════════════════════════════════════════
//  GET /api/department-tasks/departments
//  获取有部门任务的部门列表
// ═══════════════════════════════════════════════════
router.get('/departments', authMiddleware, (_req, res: Response) => {
  const rows = db.prepare(
    "SELECT DISTINCT department FROM department_tasks WHERE department IS NOT NULL AND department != '' ORDER BY department"
  ).all() as { department: string }[]
  res.json(rows.map(r => r.department))
})

// ═══════════════════════════════════════════════════
//  POST /api/department-tasks
//  导师/HR 创建部门共享任务（可从技能树快速发布）
// ═══════════════════════════════════════════════════
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可创建部门任务' })
  }

  const { title, description, department, category, skill_source_id, due_date, order_index } = req.body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: '任务标题不能为空' })
  }
  if (!department || typeof department !== 'string' || !department.trim()) {
    return res.status(400).json({ error: '所属部门不能为空' })
  }

  // 导师只能为自己部门的实习生创建部门任务
  if (req.user?.role === 'mentor') {
    if (req.user.department && department.trim() !== req.user.department) {
      return res.status(403).json({ error: `仅可为自己部门(${req.user.department})创建部门任务` })
    }
  }

  const cat = ['basic', 'department', 'advanced'].includes(category) ? category : 'department'
  const id = randomUUID()
  const orderIdx = typeof order_index === 'number' ? order_index : 0

  db.prepare(
    `INSERT INTO department_tasks (id, title, description, department, category, skill_source_id, created_by, due_date, status, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(id, title.trim(), description || '', department.trim(), cat, skill_source_id || null, req.user!.id, due_date || null, orderIdx)

  const created = db.prepare(
    `SELECT dt.*, u.name as creator_name
     FROM department_tasks dt
     LEFT JOIN users u ON u.id = dt.created_by
     WHERE dt.id = ?`
  ).get(id)

  res.status(201).json(created)
})

// ═══════════════════════════════════════════════════
//  POST /api/department-tasks/batch-from-skills
//  从技能树节点批量创建部门共享任务（一键发布）
// ═══════════════════════════════════════════════════
router.post('/batch-from-skills', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
      return res.status(403).json({ error: '仅导师和 HR 可发布部门任务' })
    }

    const { department: targetDept, skillIds, due_date } = req.body

    if (!targetDept || !Array.isArray(skillIds) || skillIds.length === 0) {
      return res.status(400).json({ error: '请选择部门和技能节点' })
    }

    // 导师只能为自己部门发布
    if (req.user?.role === 'mentor' && req.user?.department && targetDept !== req.user.department) {
      return res.status(403).json({ error: `仅可为自己部门(${req.user.department})发布部门任务` })
    }

    // 获取技能节点（使用 SELECT * 避免 schema 变动导致 500）
    const skillPlaceholders = skillIds.map(() => '?').join(',')
    const skills = db.prepare(
      `SELECT * FROM skills WHERE id IN (${skillPlaceholders})`
    ).all(...skillIds) as any[]

    if (skills.length === 0) return res.status(404).json({ error: '未找到任何有效技能节点' })

    // 过滤非叶子节点
    const validSkills = skills.filter(s => {
      const childCount = (db.prepare('SELECT COUNT(*) as cnt FROM skills WHERE parent_id = ?').get(s.id) as any)?.cnt || 0
      return childCount === 0
    })

    if (validSkills.length === 0) {
      return res.status(400).json({ error: '所选节点均为分类标题，请选择具体技能子节点发布' })
    }

    // 技能部门检查
    const wrongDept = validSkills.filter(s => s.department && s.department !== targetDept)
    if (wrongDept.length > 0) {
      return res.status(400).json({
        error: `技能「${wrongDept.map((s: any) => s.name).join('、')}」不属于部门 ${targetDept}`
      })
    }

    let created = 0
    let skipped = 0

    // 使用 try-catch 包裹事务，避免 SQL 错误导致 500
    const transaction = db.transaction(() => {
      for (const skill of validSkills) {
        // 去重
        const existing = db.prepare(
          "SELECT id FROM department_tasks WHERE department = ? AND skill_source_id = ? AND status = 'active'"
        ).get(targetDept, skill.id)
        if (existing) { skipped++; continue }

        const id = randomUUID()
        db.prepare(
          `INSERT INTO department_tasks (id, title, description, department, category, skill_source_id, created_by, due_date, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`
        ).run(id, skill.name, skill.description || '', targetDept, (skill.category || 'department'), skill.id, req.user!.id, due_date || null)
        created++
      }
    })

    transaction()

    res.status(201).json({
      success: true,
      department: targetDept,
      created,
      skipped,
      message: `成功发布 ${created} 个部门共享任务${skipped > 0 ? `，跳过 ${skipped} 个已存在任务` : ''}`,
    })
  } catch (err: any) {
    console.error('[batch-from-skills] 错误:', err?.message || err)
    res.status(500).json({ error: `发布失败：${err?.message || '未知错误'}，请检查技能树数据是否完整` })
  }
})

// ═══════════════════════════════════════════════════
//  PUT /api/department-tasks/:id
//  更新部门共享任务
// ═══════════════════════════════════════════════════
router.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可编辑部门任务' })
  }

  const existing = db.prepare('SELECT * FROM department_tasks WHERE id = ?').get(req.params.id) as DeptTaskRow
  if (!existing) return res.status(404).json({ error: '部门任务不存在' })

  // 只能编辑自己部门的任务（HR 除外）
  if (req.user?.role === 'mentor' && req.user?.department && existing.department !== req.user.department) {
    return res.status(403).json({ error: '仅可编辑本部门的任务' })
  }

  const { title, description, category, due_date, status, order_index } = req.body

  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title.trim()) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (category !== undefined && ['basic', 'department', 'advanced'].includes(category)) {
    updates.push('category = ?'); params.push(category)
  }
  if (due_date !== undefined) { updates.push('due_date = ?'); params.push(due_date || null) }
  if (status !== undefined && ['active', 'archived'].includes(status)) {
    updates.push('status = ?'); params.push(status)
  }
  if (order_index !== undefined && typeof order_index === 'number') {
    updates.push('order_index = ?'); params.push(order_index)
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    params.push(req.params.id)
    db.prepare(`UPDATE department_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params)
  }

  const updated = db.prepare(
    `SELECT dt.*, u.name as creator_name
     FROM department_tasks dt
     LEFT JOIN users u ON u.id = dt.created_by
     WHERE dt.id = ?`
  ).get(req.params.id)

  res.json(updated)
})

// ═══════════════════════════════════════════════════
//  DELETE /api/department-tasks/:id
//  删除部门共享任务
// ═══════════════════════════════════════════════════
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可删除部门任务' })
  }

  const existing = db.prepare('SELECT * FROM department_tasks WHERE id = ?').get(req.params.id) as DeptTaskRow
  if (!existing) return res.status(404).json({ error: '部门任务不存在' })

  if (req.user?.role === 'mentor') {
    // 导师只能删自己创建的 或 自己部门的
    if (existing.created_by !== req.user?.id && req.user?.department !== existing.department) {
      return res.status(403).json({ error: '仅可删除自己创建或本部门的任务' })
    }
  }

  db.prepare('DELETE FROM department_tasks WHERE id = ?').run(req.params.id)
  res.json({ success: true, message: `已删除「${existing.title}」` })
})

export default router
