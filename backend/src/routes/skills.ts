import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

// ═══════════════════════════════════════════════════
//  类型
// ═══════════════════════════════════════════════════
type SkillRow = {
  id: string
  name: string
  department: string | null
  parent_id: string | null
  category: 'basic' | 'department' | 'advanced'
  description: string | null
  resources: string
  order_index: number
  created_at: string
}

type SkillNode = SkillRow & {
  children: SkillNode[]
  resources_parsed: string[]
}

type SkillWithStatus = SkillRow & {
  status: string
  resources_parsed: string[]
  children: SkillWithStatus[]
}

type SkillGrouped = {
  category: 'basic' | 'department' | 'advanced'
  categoryLabel: string
  categoryIcon: string
  nodes: SkillWithStatus[]
}

// ═══════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════
function parseResources(raw: string): string[] {
  try { return JSON.parse(raw) } catch { return [] }
}

function buildTree(rows: SkillRow[], parentId: string | null = null): SkillNode[] {
  return rows
    .filter(r => r.parent_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
    .map(r => ({
      ...r,
      resources_parsed: parseResources(r.resources),
      children: buildTree(rows, r.id),
    }))
}

function buildTreeWithStatus(rows: SkillRow[], userSkills: Map<string, string>, parentId: string | null = null): SkillWithStatus[] {
  return rows
    .filter(r => r.parent_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
    .map(r => ({
      ...r,
      status: userSkills.get(r.id) || 'locked',
      resources_parsed: parseResources(r.resources),
      children: buildTreeWithStatus(rows, userSkills, r.id),
    }))
}

function validateSkillBody(body: any, isUpdate = false): string | null {
  const { name, department, resources, category } = body
  if (!isUpdate) {
    if (!name || typeof name !== 'string' || !name.trim()) return '技能名称不能为空'
    if (!department || typeof department !== 'string' || !department.trim()) return '所属部门不能为空'
  } else {
    if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) return '技能名称不能为空'
    if (department !== undefined && (!department || typeof department !== 'string' || !department.trim())) return '所属部门不能为空'
  }
  if (name && name.trim().length > 128) return '技能名称不能超过128个字符'
  if (resources !== undefined && !Array.isArray(resources)) return '学习资料必须是数组格式'
  if (category !== undefined && !['basic', 'department', 'advanced'].includes(category)) return '分类必须为 basic/department/advanced'
  return null
}

// ═══════════════════════════════════════════════════
//  GET /api/skills/tree?department=X
//  按部门获取技能树（实习生端核心接口，返回三阶分组）
// ═══════════════════════════════════════════════════
router.get('/tree', authMiddleware, (req: AuthRequest, res: Response) => {
  const department = (req.query.department as string) || req.user?.department
  const userId = req.user?.id

  // 权限：实习生只能看自己部门；导师/HR 可以看指定部门
  if (req.user?.role === 'intern' && department && req.user.department && department !== req.user.department) {
    return res.status(403).json({ error: '只能查看自己部门的技能树' })
  }

  let rows: SkillRow[]
  if (department) {
    rows = db.prepare(`
      WITH RECURSIVE dept_skills AS (
        SELECT * FROM skills WHERE department = ?
        UNION ALL
        SELECT s.* FROM skills s
        JOIN dept_skills ds ON s.parent_id = ds.id
      )
      SELECT DISTINCT * FROM dept_skills ORDER BY order_index
    `).all(department) as SkillRow[]
  } else {
    rows = db.prepare('SELECT * FROM skills ORDER BY order_index').all() as SkillRow[]
  }

  // 获取当前用户的技能状态
  const userSkillRows = db.prepare(
    'SELECT skill_id, status FROM user_skills WHERE user_id = ?'
  ).all(userId) as { skill_id: string; status: string }[]
  const userSkills = new Map(userSkillRows.map(r => [r.skill_id, r.status]))

  const tree = buildTreeWithStatus(rows, userSkills)

  // 按 category 分组
  const categoryOrder: { key: 'basic'|'department'|'advanced'; label: string; icon: string }[] = [
    { key: 'basic', label: '基础素养', icon: '🌱' },
    { key: 'department', label: '部门专精', icon: '🔧' },
    { key: 'advanced', label: '进阶业务', icon: '🚀' },
  ]

  const grouped: SkillGrouped[] = categoryOrder.map(cat => ({
    category: cat.key,
    categoryLabel: cat.label,
    categoryIcon: cat.icon,
    nodes: tree.filter(n => n.category === cat.key),
  }))

  res.json({ department: department || null, tree, grouped })
})

// ═══════════════════════════════════════════════════
//  GET /api/skills
//  获取所有技能（扁平列表，管理端使用）
// ═══════════════════════════════════════════════════
router.get('/', authMiddleware, (_req, res: Response) => {
  const rows = db.prepare(
    `SELECT s.*,
      (SELECT COUNT(*) FROM skills WHERE parent_id = s.id) as child_count
     FROM skills s ORDER BY s.department, s.order_index`
  ).all() as (SkillRow & { child_count: number })[]

  res.json(rows.map(r => ({
    ...r,
    resources_parsed: parseResources(r.resources),
  })))
})

// ═══════════════════════════════════════════════════
//  GET /api/skills/departments
//  获取所有有技能树的部门列表
// ═══════════════════════════════════════════════════
router.get('/departments', authMiddleware, (_req, res: Response) => {
  const rows = db.prepare(
    "SELECT DISTINCT department FROM skills WHERE department IS NOT NULL AND department != '' ORDER BY department"
  ).all() as { department: string }[]
  res.json(rows.map(r => r.department))
})

// ═══════════════════════════════════════════════════
//  GET /api/skills/me
//  获取当前用户的技能状态（扁平列表）
// ═══════════════════════════════════════════════════
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id
  const rows = db.prepare(
    `SELECT s.id, s.name, s.department, s.description, s.parent_id, s.resources, s.order_index, s.created_at,
            COALESCE(us.status, 'locked') AS status
     FROM skills s
     LEFT JOIN user_skills us ON us.skill_id = s.id AND us.user_id = ?
     ORDER BY s.department, s.order_index`
  ).all(userId) as (SkillRow & { status: string })[]

  res.json(rows.map(r => ({
    ...r,
    resources_parsed: parseResources(r.resources),
  })))
})

// ═══════════════════════════════════════════════════
//  POST /api/skills/me
//  更新当前用户的技能状态
// ═══════════════════════════════════════════════════
router.post('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id
  const { skillId, status } = req.body
  if (!skillId || !['locked', 'in_progress', 'mastered'].includes(status)) {
    return res.status(400).json({ error: '无效技能状态' })
  }

  // 验证技能存在
  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId)
  if (!skill) return res.status(404).json({ error: '技能节点不存在' })

  db.prepare(
    `INSERT INTO user_skills (user_id, skill_id, status)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, skill_id) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP`
  ).run(userId, skillId, status)

  res.json({ success: true, skillId, status })
})

// ═══════════════════════════════════════════════════
//  POST /api/skills        创建技能节点（导师/HR）
// ═══════════════════════════════════════════════════
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  if (!['mentor', 'hr'].includes(req.user?.role || '')) {
    return res.status(403).json({ error: '仅导师和 HR 可管理技能树' })
  }

  const body = req.body
  const err = validateSkillBody(body)
  if (err) return res.status(400).json({ error: err })

  const { name, department, parent_id, parent_name, description, resources, order_index, category } = body

  // ── 自定义父节点名称：自动查找或创建 ──
  let resolvedParentId: string | null = parent_id || null

  if (!resolvedParentId && parent_name && typeof parent_name === 'string' && parent_name.trim()) {
    const trimmedParentName = parent_name.trim()
    if (trimmedParentName.length > 128) {
      return res.status(400).json({ error: '父节点名称不能超过128个字符' })
    }
    if (trimmedParentName === name.trim()) {
      return res.status(400).json({ error: '父节点不能与当前节点同名' })
    }
    // 在同部门查找同名节点
    const existing = db.prepare(
      'SELECT id, department FROM skills WHERE name = ? AND department = ?'
    ).get(trimmedParentName, department.trim()) as any
    if (existing) {
      resolvedParentId = existing.id
    } else {
      // 自动创建父节点（category 默认 department）
      const newParentId = randomUUID()
      db.prepare(
        `INSERT INTO skills (id, name, department, parent_id, category, description, resources, order_index)
         VALUES (?, ?, ?, NULL, 'department', '', '[]', 0)`
      ).run(newParentId, trimmedParentName, department.trim())
      resolvedParentId = newParentId
    }
  }

  // 如果指定了父节点，验证存在且部门匹配
  if (resolvedParentId) {
    const parent = db.prepare('SELECT department FROM skills WHERE id = ?').get(resolvedParentId) as any
    if (!parent) return res.status(400).json({ error: '父节点不存在' })
    if (parent.department !== department.trim()) {
      return res.status(400).json({ error: '子节点部门必须与父节点保持一致' })
    }
  }

  // ── 重名检测（同部门下不允许同名节点）──
  const duplicate = db.prepare(
    'SELECT id FROM skills WHERE name = ? AND department = ?'
  ).get(name.trim(), department.trim()) as any
  if (duplicate) {
    return res.status(400).json({ error: `该部门下已存在同名节点「${name.trim()}」` })
  }

  const id = randomUUID()
  const orderIdx = typeof order_index === 'number' ? order_index : 0
  const cat = ['basic', 'department', 'advanced'].includes(category) ? category : 'department'

  db.prepare(
    `INSERT INTO skills (id, name, department, parent_id, category, description, resources, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name.trim(), department.trim(), resolvedParentId, cat, description || '', JSON.stringify(resources || []), orderIdx)

  const created = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow
  res.status(201).json({ ...created, resources_parsed: parseResources(created.resources) })
})

// ═══════════════════════════════════════════════════
//  PUT /api/skills/:id     更新技能节点（导师/HR）
// ═══════════════════════════════════════════════════
router.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  if (!['mentor', 'hr'].includes(req.user?.role || '')) {
    return res.status(403).json({ error: '仅导师和 HR 可管理技能树' })
  }

  const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id) as SkillRow
  if (!existing) return res.status(404).json({ error: '技能节点不存在' })

  const body = req.body
  const err = validateSkillBody(body, true)
  if (err) return res.status(400).json({ error: err })

  const name = body.name !== undefined ? body.name.trim() : existing.name
  const department = body.department !== undefined ? body.department.trim() : existing.department
  let parentId: string | null = body.parent_id !== undefined ? (body.parent_id || null) : existing.parent_id
  const description = body.description !== undefined ? body.description : existing.description
  const resources = body.resources !== undefined ? JSON.stringify(body.resources) : existing.resources
  const orderIdx = body.order_index !== undefined ? body.order_index : existing.order_index
  const category = body.category !== undefined ? body.category : existing.category

  // ── 自定义父节点名称：自动查找或创建 ──
  const parentName = body.parent_name as string | undefined
  if (parentName !== undefined && typeof parentName === 'string' && parentName.trim()) {
    const trimmedParentName = parentName.trim()
    if (trimmedParentName.length > 128) {
      return res.status(400).json({ error: '父节点名称不能超过128个字符' })
    }
    if (trimmedParentName === name) {
      return res.status(400).json({ error: '父节点不能与当前节点同名' })
    }
    // 查找同部门同名节点（排除自身）
    const existingParent = db.prepare(
      'SELECT id FROM skills WHERE name = ? AND department = ? AND id != ?'
    ).get(trimmedParentName, department, req.params.id) as any
    if (existingParent) {
      parentId = existingParent.id
    } else {
      const newParentId = randomUUID()
      db.prepare(
        `INSERT INTO skills (id, name, department, parent_id, category, description, resources, order_index)
         VALUES (?, ?, ?, NULL, 'department', '', '[]', 0)`
      ).run(newParentId, trimmedParentName, department)
      parentId = newParentId
    }
  } else if (parentName !== undefined && !parentName.trim()) {
    // 明确传空字符串 = 提为根节点
    parentId = null
  }

  // 不能把自己设为自己的父节点
  if (parentId === req.params.id) {
    return res.status(400).json({ error: '不能将节点设为自己的父节点' })
  }

  // 验证父节点
  if (parentId) {
    const parent = db.prepare('SELECT id, department FROM skills WHERE id = ?').get(parentId) as any
    if (!parent) return res.status(400).json({ error: '父节点不存在' })
    if (parent.department !== department) {
      return res.status(400).json({ error: '子节点部门必须与父节点保持一致' })
    }
  }

  db.prepare(
    `UPDATE skills SET name=?, department=?, parent_id=?, description=?, resources=?, order_index=?, category=?
     WHERE id=?`
  ).run(name, department, parentId, description, resources, orderIdx, category, req.params.id)

  const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id) as SkillRow
  res.json({ ...updated, resources_parsed: parseResources(updated.resources) })
})

// ═══════════════════════════════════════════════════
//  DELETE /api/skills/:id  删除技能节点（导师/HR）
// ═══════════════════════════════════════════════════
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  if (!['mentor', 'hr'].includes(req.user?.role || '')) {
    return res.status(403).json({ error: '仅导师和 HR 可管理技能树' })
  }

  const existing = db.prepare('SELECT id FROM skills WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: '技能节点不存在' })

  // 先删除子节点的 user_skills 记录，再设子节点的父节点为 NULL（避免级联删除）
  const children = db.prepare('SELECT id FROM skills WHERE parent_id = ?').all(req.params.id) as { id: string }[]
  for (const child of children) {
    db.prepare('UPDATE skills SET parent_id = NULL WHERE id = ?').run(child.id)
  }

  // 删除本节点的 user_skills 关联和节点本身
  db.prepare('DELETE FROM user_skills WHERE skill_id = ?').run(req.params.id)
  db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id)

  res.json({ success: true, orphaned_children: children.length })
})

// ═══════════════════════════════════════════════════
//  POST /api/skills/batch-status  批量更新技能状态
// ═══════════════════════════════════════════════════
router.post('/batch-status', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user?.id
  const { updates } = req.body // [{skillId, status}, ...]
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates 必须是数组' })

  const stmt = db.prepare(
    `INSERT INTO user_skills (user_id, skill_id, status)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, skill_id) DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP`
  )

  const tx = db.transaction(() => {
    for (const u of updates) {
      if (!u.skillId || !['locked', 'in_progress', 'mastered'].includes(u.status)) continue
      stmt.run(userId, u.skillId, u.status)
    }
  })
  tx()

  res.json({ success: true, count: updates.length })
})

// ═══════════════════════════════════════════════════
//  【导师端】GET /api/skills/mentor/interns
//  获取导师麾下的实习生列表及技能进度概览
// ═══════════════════════════════════════════════════
router.get('/mentor/interns', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可查看' })
  }

  const mentorId = req.user?.id
  const { department } = req.query

  // 导师看自己负责的实习生，HR 看全部（可按部门筛选）
  let interns: any[]
  if (req.user?.role === 'hr') {
    let query = `SELECT id, name, email, department, avatar_url, intern_start_date, intern_end_date, mentor_id
       FROM users WHERE role = 'intern'`
    let params: any[] = []
    if (department) {
      query += ' AND department = ?'
      params.push(department as string)
    }
    query += ' ORDER BY name'
    interns = params.length > 0 ? db.prepare(query).all(...params) : db.prepare(query).all()
  } else {
    // 导师按部门只看到自己部门的实习生 + 自己负责的实习生
    const mentorDept = req.user?.department || ''
    interns = db.prepare(
      `SELECT id, name, email, department, avatar_url, intern_start_date, intern_end_date, mentor_id
       FROM users WHERE role = 'intern' AND (mentor_id = ? OR (mentor_id IS NULL AND department = ?)) ORDER BY name`
    ).all(mentorId, mentorDept)
  }

  // 计算每个实习生的技能进度
  const result = interns.map((intern: any) => {
    const dept = intern.department
    // 获取该实习生部门的全部叶子技能数量
    const totalRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM skills s
       WHERE s.department = ? AND NOT EXISTS (SELECT 1 FROM skills WHERE parent_id = s.id)`
    ).get(dept) as any
    const totalLeaf = totalRow?.cnt || 0

    // 获取该实习生已掌握的技能数量
    const masteredRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = ? AND us.status = 'mastered' AND s.department = ?`
    ).get(intern.id, dept) as any
    const mastered = masteredRow?.cnt || 0

    // 学习中数量
    const inProgressRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM user_skills us
       JOIN skills s ON s.id = us.skill_id
       WHERE us.user_id = ? AND us.status = 'in_progress' AND s.department = ?`
    ).get(intern.id, dept) as any
    const inProgress = inProgressRow?.cnt || 0

    // 自定义任务统计
    const customTaskTotal = db.prepare(
      'SELECT COUNT(*) as cnt FROM mentor_tasks WHERE intern_id = ?'
    ).get(intern.id) as any
    const customTaskMastered = db.prepare(
      "SELECT COUNT(*) as cnt FROM mentor_tasks WHERE intern_id = ? AND status = 'mastered'"
    ).get(intern.id) as any
    const customTaskInProgress = db.prepare(
      "SELECT COUNT(*) as cnt FROM mentor_tasks WHERE intern_id = ? AND status = 'in_progress'"
    ).get(intern.id) as any

    return {
      id: intern.id,
      name: intern.name,
      email: intern.email,
      department: intern.department,
      avatar_url: intern.avatar_url,
      intern_start_date: intern.intern_start_date,
      intern_end_date: intern.intern_end_date,
      skillProgress: {
        total: totalLeaf,
        mastered,
        inProgress,
        notStarted: Math.max(0, totalLeaf - mastered - inProgress),
        percent: totalLeaf > 0 ? Math.round((mastered / totalLeaf) * 100) : 0,
      },
      customTaskProgress: {
        total: customTaskTotal?.cnt || 0,
        mastered: customTaskMastered?.cnt || 0,
        inProgress: customTaskInProgress?.cnt || 0,
        notStarted: (customTaskTotal?.cnt || 0) - (customTaskMastered?.cnt || 0) - (customTaskInProgress?.cnt || 0),
        percent: (customTaskTotal?.cnt || 0) > 0
          ? Math.round(((customTaskMastered?.cnt || 0) / (customTaskTotal?.cnt || 0)) * 100)
          : 0,
      },
    }
  })

  res.json(result)
})

// ═══════════════════════════════════════════════════
//  【导师端】GET /api/skills/mentor/intern/:internId
//  查看特定实习生的完整技能树（含状态）
// ═══════════════════════════════════════════════════
router.get('/mentor/intern/:internId', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可查看' })
  }

  const internId = req.params.internId
  const intern = db.prepare(
    'SELECT id, name, email, department, mentor_id FROM users WHERE id = ? AND role = ?'
  ).get(internId, 'intern') as any

  if (!intern) return res.status(404).json({ error: '实习生不存在' })

  // 权限：导师只能看自己的实习生，HR 可看全部
  if (req.user?.role === 'mentor' && intern.mentor_id !== req.user?.id) {
    return res.status(403).json({ error: '仅可查看自己负责的实习生' })
  }

  const dept = intern.department
  if (!dept) {
    return res.json({ intern: { id: intern.id, name: intern.name, email: intern.email, department: null }, tree: [], grouped: [] })
  }

  // 获取部门技能树
  const rows = db.prepare(`
    WITH RECURSIVE dept_skills AS (
      SELECT * FROM skills WHERE department = ?
      UNION ALL
      SELECT s.* FROM skills s JOIN dept_skills ds ON s.parent_id = ds.id
    )
    SELECT DISTINCT * FROM dept_skills ORDER BY order_index
  `).all(dept) as SkillRow[]

  const userSkillRows = db.prepare(
    'SELECT skill_id, status FROM user_skills WHERE user_id = ?'
  ).all(internId) as { skill_id: string; status: string }[]
  const userSkills = new Map(userSkillRows.map(r => [r.skill_id, r.status]))

  const tree = buildTreeWithStatus(rows, userSkills)

  const categoryOrder: { key: 'basic'|'department'|'advanced'; label: string; icon: string }[] = [
    { key: 'basic', label: '基础素养', icon: '🌱' },
    { key: 'department', label: '部门专精', icon: '🔧' },
    { key: 'advanced', label: '进阶业务', icon: '🚀' },
  ]
  const grouped = categoryOrder.map(cat => ({
    category: cat.key,
    categoryLabel: cat.label,
    categoryIcon: cat.icon,
    nodes: tree.filter(n => n.category === cat.key),
  }))

  // 获取该实习生的反馈记录
  const feedbacks = db.prepare(
    `SELECT sf.*, s.name as skill_name
     FROM skill_feedbacks sf
     JOIN skills s ON s.id = sf.skill_id
     WHERE sf.intern_id = ?
     ORDER BY sf.created_at DESC`
  ).all(internId)

  // 获取该实习生的自定义任务
  const customTasks = db.prepare(
    `SELECT mt.*, u.name as mentor_name
     FROM mentor_tasks mt
     LEFT JOIN users u ON u.id = mt.mentor_id
     WHERE mt.intern_id = ?
     ORDER BY mt.order_index, mt.created_at DESC`
  ).all(internId)

  res.json({
    intern: { id: intern.id, name: intern.name, email: intern.email, department: intern.department },
    tree,
    grouped,
    feedbacks,
    customTasks,
  })
})

// ═══════════════════════════════════════════════════
//  【导师端】POST /api/skills/feedback
//  导师对实习生的某项技能提交评价反馈
// ═══════════════════════════════════════════════════
router.post('/feedback', authMiddleware, (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可提交反馈' })
  }

  const { internId, skillId, content, rating } = req.body
  if (!internId || !skillId || !content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: '实习生、技能和反馈内容不能为空' })
  }

  // 验证实习生存在且为当前导师负责
  const intern = db.prepare('SELECT id, mentor_id FROM users WHERE id = ? AND role = ?').get(internId, 'intern') as any
  if (!intern) return res.status(404).json({ error: '实习生不存在' })
  if (req.user?.role === 'mentor' && intern.mentor_id !== req.user?.id) {
    return res.status(403).json({ error: '仅可对负责的实习生提供反馈' })
  }

  // 验证技能存在
  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId)
  if (!skill) return res.status(404).json({ error: '技能节点不存在' })

  const id = randomUUID()
  const rate = typeof rating === 'number' && rating >= 0 && rating <= 5 ? rating : 0

  db.prepare(
    `INSERT INTO skill_feedbacks (id, intern_id, mentor_id, skill_id, content, rating)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, internId, req.user!.id, skillId, content.trim(), rate)

  const created = db.prepare(
    `SELECT sf.*, s.name as skill_name FROM skill_feedbacks sf
     JOIN skills s ON s.id = sf.skill_id WHERE sf.id = ?`
  ).get(id)

  res.status(201).json(created)
})

// ═══════════════════════════════════════════════════
//  GET /api/skills/feedback/:internId
//  获取某个实习生的所有反馈记录
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
//  POST /api/skills/publish-tasks
//  导师从技能树中选择节点，批量发布为实习生的待办任务
// ═══════════════════════════════════════════════════
router.post('/publish-tasks', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'mentor' && req.user?.role !== 'hr') {
      return res.status(403).json({ error: '仅导师和 HR 可发布任务' })
    }

    const { internId, skillIds, due_date, scope } = req.body
    // scope: 'personal' | 'department' — 个人任务 / 部门共享任务（同部门实习生可见）
    const targetScope = scope === 'department' ? 'department' : 'personal'

    if (targetScope === 'department') {
      // ── 部门共享模式：批量创建 department_tasks ──
      if (!Array.isArray(skillIds) || skillIds.length === 0) {
        return res.status(400).json({ error: '请选择要发布的目标技能节点' })
      }

      const targetDept = req.body.department || req.user?.department
      if (!targetDept) return res.status(400).json({ error: '部门共享任务必须指定部门' })

      if (req.user?.role === 'mentor' && req.user?.department && targetDept !== req.user.department) {
        return res.status(403).json({ error: `仅可为自己部门(${req.user.department})发布部门任务` })
      }

      const skillPlaceholders = skillIds.map(() => '?').join(',')
      // 使用 SELECT * 代替明确列名，防止 category 列丢失导致 500
      const skills = db.prepare(
        `SELECT * FROM skills WHERE id IN (${skillPlaceholders})`
      ).all(...skillIds) as any[]

      if (skills.length === 0) return res.status(404).json({ error: '未找到任何有效技能节点' })

      const validSkills = skills.filter(s => {
        const childCount = (db.prepare('SELECT COUNT(*) as cnt FROM skills WHERE parent_id = ?').get(s.id) as any)?.cnt || 0
        return childCount === 0
      })

      if (validSkills.length === 0) {
        return res.status(400).json({ error: '所选节点均为分类标题，请选择具体技能子节点发布' })
      }

      const wrongDept = validSkills.filter(s => s.department && s.department !== targetDept)
      if (wrongDept.length > 0) {
        return res.status(400).json({
          error: `技能「${wrongDept.map((s: any) => s.name).join('、')}」不属于部门 ${targetDept}`
        })
      }

      let created = 0, skipped = 0
      db.transaction(() => {
        for (const skill of validSkills) {
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
      })()

      return res.status(201).json({
        success: true,
        scope: 'department',
        department: targetDept,
        created,
        skipped,
        message: `成功发布 ${created} 个部门共享任务${skipped > 0 ? `，跳过 ${skipped} 个已存在任务` : ''}`,
      })
    }

  // ── 个人模式：分配给特定实习生（原有逻辑） ──
  if (!internId) {
    return res.status(400).json({ error: '请选择目标实习生' })
  }

  // 验证实习生存在
  const intern = db.prepare(
    'SELECT id, name, department, mentor_id FROM users WHERE id = ? AND role = ?'
  ).get(internId, 'intern') as any
  if (!intern) return res.status(404).json({ error: '实习生不存在' })

  // 权限：只能为已绑定的实习生发布
  if (req.user?.role === 'mentor' && intern.mentor_id !== req.user?.id) {
    return res.status(403).json({ error: '仅可为自己负责的实习生发布技能任务' })
  }

  // 验证技能节点与实习生部门匹配（使用 SELECT * 防止 schema 变动）
  const skillPlaceholders2 = skillIds.map(() => '?').join(',')
  const skills2 = db.prepare(
    `SELECT * FROM skills WHERE id IN (${skillPlaceholders2})`
  ).all(...skillIds) as any[]

  if (skills2.length === 0) return res.status(404).json({ error: '未找到任何有效技能节点' })

  // 过滤非叶子节点（只发布具体技能，不发布分类标题）
  const validSkills2 = skills2.filter(s => {
    const childCount = (db.prepare('SELECT COUNT(*) as cnt FROM skills WHERE parent_id = ?').get(s.id) as any)?.cnt || 0
    return childCount === 0
  })

  if (validSkills2.length === 0) {
    return res.status(400).json({ error: '所选节点均为分类标题，请选择具体技能子节点发布' })
  }

  // 部门验证：发布的技能必须属于实习生部门
  if (intern.department) {
    const wrongDept2 = validSkills2.filter(s => s.department && s.department !== intern.department)
    if (wrongDept2.length > 0) {
      return res.status(400).json({
        error: `技能「${wrongDept2.map((s: any) => s.name).join('、')}」不属于实习生所在部门(${intern.department})`
      })
    }
  }

  // 批量创建 mentor_tasks
  const insertTask = db.prepare(
    `INSERT INTO mentor_tasks (id, intern_id, mentor_id, title, description, category, department, skill_source_id, status, due_date, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'locked', ?, ?)`
  )

  const getMaxOrder = db.prepare(
    'SELECT COALESCE(MAX(order_index), -1) as max_order FROM mentor_tasks WHERE intern_id = ?'
  )

  let created = 0
  let skipped = 0
  const createdIds: string[] = []

  const transaction2 = db.transaction(() => {
    let baseOrder = (getMaxOrder.get(internId) as any)?.max_order ?? -1

    for (const skill of validSkills2) {
      // 检查是否已发布过同一个技能源
      const existing = db.prepare(
        'SELECT id FROM mentor_tasks WHERE intern_id = ? AND skill_source_id = ?'
      ).get(internId, skill.id)
      if (existing) {
        skipped++
        continue
      }

      baseOrder++
      const taskId = randomUUID()
      insertTask.run(
        taskId,
        internId,
        req.user!.id,
        skill.name,
        skill.description || '',
        (skill.category || 'department'),
        skill.department || intern.department,
        skill.id,
        due_date || null,
        baseOrder
      )
      createdIds.push(taskId)
      created++
    }
  })

  transaction2()

  return res.status(201).json({
    success: true,
    scope: 'personal',
    intern: { id: intern.id, name: intern.name, department: intern.department },
    created,
    skipped,
    taskIds: createdIds,
    message: `成功发布 ${created} 个技能任务${skipped > 0 ? `，跳过 ${skipped} 个已存在任务` : ''}`,
  })
  } catch (err: any) {
    console.error('[publish-tasks] 错误:', err?.message || err)
    return res.status(500).json({ error: `发布失败：${err?.message || '未知错误'}，请检查技能树数据是否完整` })
  }
})

// ═══════════════════════════════════════════════════
//  GET /api/skills/feedback/:internId
// ═══════════════════════════════════════════════════
router.get('/feedback/:internId', authMiddleware, (req: AuthRequest, res: Response) => {
  const internId = req.params.internId

  // 权限：实习生只能看自己的，导师看自己负责的，HR 看全部
  if (req.user?.role === 'intern' && req.user?.id !== internId) {
    return res.status(403).json({ error: '只能查看自己的反馈' })
  }

  const intern = db.prepare('SELECT id, mentor_id FROM users WHERE id = ? AND role = ?').get(internId, 'intern') as any
  if (!intern) return res.status(404).json({ error: '实习生不存在' })
  if (req.user?.role === 'mentor' && intern.mentor_id !== req.user?.id) {
    return res.status(403).json({ error: '仅可查看负责实习生的反馈' })
  }

  const feedbacks = db.prepare(
    `SELECT sf.*, s.name as skill_name, u.name as mentor_name
     FROM skill_feedbacks sf
     JOIN skills s ON s.id = sf.skill_id
     JOIN users u ON u.id = sf.mentor_id
     WHERE sf.intern_id = ?
     ORDER BY sf.created_at DESC`
  ).all(internId)

  res.json(feedbacks)
})

export default router
