import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

// ── GET /api/notifications ────────────────────
router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const userId = req.user?.id
  const role = req.user?.role

  let query = 'SELECT * FROM notifications'
  let params: any[] = []

  if (role === 'hr') {
    // HR 可以看到全部通知
    query += ' ORDER BY created_at DESC LIMIT 50'
  } else {
    query += ' WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
    params = [userId!]
  }

  const result = params.length > 0
    ? db.prepare(query).all(...params)
    : db.prepare(query).all()
  res.json(result)
})

// ── PATCH /api/notifications/:id ──────────────
router.patch('/:id', authMiddleware, (req: AuthRequest, res) => {
  const { id } = req.params
  const { is_read } = req.body

  const existing = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
  if (!existing) return res.status(404).json({ error: '通知不存在' })

  // 仅通知所有者或 HR 可以标记
  if (existing.user_id !== req.user?.id && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '无权操作此通知' })
  }

  db.prepare('UPDATE notifications SET is_read = ? WHERE id = ?').run(is_read ? 1 : 0, id)
  res.json({ success: true })
})

// ── POST /api/notifications/send ──────────────
// 导师/HR 向指定用户发送通知
router.post('/send', authMiddleware, (req: AuthRequest, res) => {
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
    'INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, datetime(\'now\', \'localtime\'))'
  )

  const tx = db.transaction(() => {
    for (const uid of user_ids) {
      // 验证用户存在
      const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(uid)
      if (exists) {
        const nid = randomUUID()
        insert.run(nid, uid, notificationType, title, content)
        ids.push(nid)
      }
    }
  })
  tx()

  res.status(201).json({ success: true, sent: ids.length })
})

// ── POST /api/notifications/broadcast ─────────
// HR 向所有实习生/导师群发通知
router.post('/broadcast', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅 HR 可群发通知' })
  }

  const { title, content, target_role, type } = req.body
  if (!title || !content || !target_role) {
    return res.status(400).json({ error: '缺少必要字段：target_role、title、content' })
  }

  const users = db.prepare('SELECT id FROM users WHERE role = ?').all(target_role) as any[]
  if (users.length === 0) {
    return res.status(404).json({ error: `没有找到角色为「${target_role}」的用户` })
  }

  const notificationType = type || 'announcement'

  const insert = db.prepare(
    "INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, datetime('now', 'localtime'))"
  )

  const tx = db.transaction(() => {
    for (const u of users) {
      insert.run(randomUUID(), u.id, notificationType, title, content)
    }
  })
  tx()

  res.status(201).json({ success: true, sent: users.length })
})

// ── DELETE /api/notifications/:id ─────────────
router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ error: '通知不存在' })

  if (existing.user_id !== req.user?.id && req.user?.role !== 'hr') {
    return res.status(403).json({ error: '无权删除' })
  }

  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
