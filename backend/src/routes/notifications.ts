import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

// ── GET /api/notifications ────────────────────
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user?.id
  const role = req.user?.role

  let query = 'SELECT * FROM notifications'
  let params: any[] = []

  if (role === 'hr') {
    query += ' ORDER BY created_at DESC LIMIT 50'
  } else {
    query += ' WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
    params = [userId!]
  }

  const result = params.length > 0
    ? await db.prepare(query).all(...params)
    : await db.prepare(query).all()
  res.json(result)
})

// ── PATCH /api/notifications/:id ──────────────
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const { id } = req.params
  const { is_read } = req.body

  const existing = await db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
  if (!existing) return res.status(404).json({ error: '通知不存在' })

  if (existing.user_id !== req.user?.id && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '无权操作此通知' })
  }

  await db.prepare('UPDATE notifications SET is_read = ? WHERE id = ?').run(is_read ? true : false, id)
  res.json({ success: true })
})

// ── POST /api/notifications/send ──────────────
router.post('/send', authMiddleware, async (req: AuthRequest, res) => {
  const role = req.user?.role
  if (role !== 'mentor' && role !== 'hr') {
    return res.status(403).json({ error: '仅导师和 HR 可发送通知' })
  }

  const { user_ids, title, content, type } = req.body
  if (!title || !content || !user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: '缺少必要字段：user_ids(数组)、title、content' })
  }

  const notificationType = type || 'reminder'
  const ids: string[] = []

  const insert = db.prepare(
    "INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, FALSE, NOW())"
  )

  const tx = db.transaction(async () => {
    for (const uid of user_ids) {
      const exists = await db.prepare('SELECT id FROM users WHERE id = ?').get(uid)
      if (exists) {
        const nid = randomUUID()
        await insert.run(nid, uid, notificationType, title, content)
        ids.push(nid)
      }
    }
  })
  await tx()

  res.status(201).json({ success: true, sent: ids.length })
})

// ── POST /api/notifications/broadcast ─────────
router.post('/broadcast', authMiddleware, async (req: AuthRequest, res) => {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅 HR 可群发通知' })
  }

  const { title, content, target_role, type } = req.body
  if (!title || !content || !target_role) {
    return res.status(400).json({ error: '缺少必要字段：target_role、title、content' })
  }

  const users = await db.prepare('SELECT id FROM users WHERE role = ?').all(target_role) as any[]
  if (users.length === 0) {
    return res.status(404).json({ error: `没有找到角色为「${target_role}」的用户` })
  }

  const notificationType = type || 'announcement'

  const insert = db.prepare(
    "INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, FALSE, NOW())"
  )

  const tx = db.transaction(async () => {
    for (const u of users) {
      await insert.run(randomUUID(), u.id, notificationType, title, content)
    }
  })
  await tx()

  res.status(201).json({ success: true, sent: users.length })
})

// ── DELETE /api/notifications/:id ─────────────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const existing = await db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ error: '通知不存在' })

  if (existing.user_id !== req.user?.id && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '无权删除' })
  }

  await db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
