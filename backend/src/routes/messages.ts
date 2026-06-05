import { Router, Response } from 'express'
import { randomUUID } from 'crypto'
import { db } from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// 所有消息接口都需要登录
router.use(authMiddleware)

/* ── 获取当前用户的联系人列表 ───────────────── */
router.get('/contacts', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const role = req.user!.role

  // 统一逻辑：默认可见用户（按角色规则） + 所有有过消息往来的用户
  // 这样 HR 给实习生发消息后，实习生也能看到 HR
  let contacts: any[]

  if (role === 'intern') {
    // 实习生：所有 mentor + 任何有过对话的用户（含 HR 等）
    contacts = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.role, u.department, u.avatar_url,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread
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
    // 导师：所有 intern + 任何有过对话的用户
    contacts = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.role, u.department, u.avatar_url,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread
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
    // HR：可以看到所有人
    contacts = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.role, u.department, u.avatar_url,
        (SELECT COUNT(*) FROM messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread
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
router.get('/conversation/:userId', (req: AuthRequest, res: Response) => {
  const myId = req.user!.id
  const otherId = req.params.userId

  const messages = db.prepare(`
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

  // 标记对方发来的消息为已读
  db.prepare(`
    UPDATE messages SET is_read = 1
    WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
  `).run(otherId, myId)

  res.json(messages)
})

/* ── 发送消息 ───────────────────────────── */
router.post('/send', (req: AuthRequest, res: Response) => {
  const senderId = req.user!.id
  const { receiver_id, content } = req.body

  if (!receiver_id || !content || !content.trim()) {
    return res.status(400).json({ error: '缺少接收人或消息内容' })
  }

  const id = `msg_${randomUUID()}`
  const trimmedContent = content.trim()

  db.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, content)
    VALUES (?, ?, ?, ?)
  `).run(id, senderId, receiver_id, trimmedContent)

  // 查询刚插入的消息，联表获取发送者/接收者信息
  const msg = db.prepare(`
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
router.get('/unread-count', (req: AuthRequest, res: Response) => {
  const userId = req.user!.id

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE receiver_id = ? AND is_read = 0
  `).get(userId) as any

  res.json({ count: result.count })
})

export default router
