import { Router, Response } from 'express'
import { randomUUID } from 'crypto'
import { db } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

router.use(authMiddleware)

/* ── 获取当前用户的联系人列表 ───────────────── */
router.get('/contacts', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const role = req.user!.role

  let contacts: any[]

  if (role === 'intern') {
    contacts = await db.prepare(`
      SELECT DISTINCT u.id, u.name, u.role, u.department, u.avatar_url,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE) as unread
      FROM users u
      WHERE u.id != ?
        AND (
          u.role = 'mentor'
          OR EXISTS (
            SELECT 1 FROM messages m
            WHERE (m.sender_id = u.id AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = u.id)
          )
        )
      ORDER BY CASE WHEN u.role = 'mentor' THEN 0 ELSE 1 END, u.name
    `).all(userId, userId, userId, userId) as any[]
  } else if (role === 'mentor') {
    contacts = await db.prepare(`
      SELECT DISTINCT u.id, u.name, u.role, u.department, u.avatar_url,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE) as unread
      FROM users u
      WHERE u.id != ?
        AND (
          u.role = 'intern'
          OR EXISTS (
            SELECT 1 FROM messages m
            WHERE (m.sender_id = u.id AND m.receiver_id = ?)
               OR (m.sender_id = ? AND m.receiver_id = u.id)
          )
        )
      ORDER BY CASE WHEN u.role = 'intern' THEN 0 ELSE 1 END, u.name
    `).all(userId, userId, userId, userId) as any[]
  } else {
    contacts = await db.prepare(`
      SELECT DISTINCT u.id, u.name, u.role, u.department, u.avatar_url,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = FALSE) as unread
      FROM users u
      WHERE u.id != ?
      ORDER BY u.role, u.name
    `).all(userId, userId) as any[]
  }

  res.json(contacts.map(c => ({
    ...c,
    unread: c.unread || 0,
  })))
})

/* ── 获取与某人的对话记录 ───────────────── */
router.get('/conversation/:userId', async (req: AuthRequest, res: Response) => {
  const myId = req.user!.id
  const otherId = req.params.userId

  const messages = await db.prepare(`
    SELECT m.*, 
      s.name as sender_name, s.role as sender_role,
      r.name as receiver_name, r.role as receiver_role
    FROM messages m
    JOIN users s ON s.id = m.sender_id
    JOIN users r ON r.id = m.receiver_id
    WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
    LIMIT 200
  `).all(myId, otherId, otherId, myId) as any[]

  await db.prepare(`
    UPDATE messages SET is_read = TRUE
    WHERE sender_id = ? AND receiver_id = ? AND is_read = FALSE
  `).run(otherId, myId)

  res.json(messages)
})

/* ── 发送消息 ───────────────────────────── */
router.post('/send', async (req: AuthRequest, res: Response) => {
  const senderId = req.user!.id
  const { receiver_id, content } = req.body

  if (!receiver_id || !content || !content.trim()) {
    return res.status(400).json({ error: '缺少接收人或消息内容' })
  }

  const id = `msg_${randomUUID()}`
  const trimmedContent = content.trim()

  await db.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, content)
    VALUES (?, ?, ?, ?)
  `).run(id, senderId, receiver_id, trimmedContent)

  const msg = await db.prepare(`
    SELECT m.*,
      s.name as sender_name, s.role as sender_role,
      r.name as receiver_name, r.role as receiver_role
    FROM messages m
    JOIN users s ON s.id = m.sender_id
    JOIN users r ON r.id = m.receiver_id
    WHERE m.id = ?
  `).get(id) as any

  res.status(201).json(msg)
})

/* ── 获取未读消息总数 ──────────────────── */
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE receiver_id = ? AND is_read = FALSE
  `).get(userId) as any

  res.json({ count: result.count })
})

export default router
