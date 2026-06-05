import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db'
import { randomUUID } from 'crypto'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()

// ── 统一错误码枚举 ────────────────────────────────
const ErrCode = {
  MISSING_FIELDS:   'MISSING_FIELDS',
  INVALID_EMAIL:    'INVALID_EMAIL',
  WEAK_PASSWORD:    'WEAK_PASSWORD',
  INVALID_NAME:     'INVALID_NAME',
  INVALID_ROLE:     'INVALID_ROLE',
  INVALID_KEY:      'INVALID_INVITE_KEY',
  KEY_ROLE_MISMATCH:'KEY_ROLE_MISMATCH',
  KEY_ALREADY_USED: 'KEY_ALREADY_USED',
  EMAIL_TAKEN:      'EMAIL_ALREADY_EXISTS',
  SERVER_ERROR:     'SERVER_ERROR',
} as const

type ErrCode = (typeof ErrCode)[keyof typeof ErrCode]

// ── 校验工具函数 ──────────────────────────────────
const VALID_ROLES = ['intern', 'mentor', 'hr'] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LEN = 8
const MAX_NAME_LEN = 64
const MAX_EMAIL_LEN = 255
const MAX_KEY_LEN = 64
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !email.trim()) return '邮箱不能为空'
  const trimmed = email.trim()
  if (trimmed.length > MAX_EMAIL_LEN) return `邮箱长度不能超过 ${MAX_EMAIL_LEN} 个字符`
  if (!EMAIL_RE.test(trimmed)) return '邮箱格式不正确，请输入有效的邮箱地址'
  return null
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return '密码不能为空'
  if (password.length < MIN_PASSWORD_LEN) return `密码至少需要 ${MIN_PASSWORD_LEN} 个字符`
  if (password.length > 128) return '密码长度不能超过 128 个字符'
  let types = 0
  if (/[a-z]/.test(password)) types++
  if (/[A-Z]/.test(password)) types++
  if (/[0-9]/.test(password)) types++
  if (/[^a-zA-Z0-9]/.test(password)) types++
  if (types < 2) return '密码需包含至少两种字符类型（大写字母、小写字母、数字、特殊符号）'
  return null
}

function validateName(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return '姓名不能为空'
  const trimmed = name.trim()
  if (trimmed.length > MAX_NAME_LEN) return `姓名长度不能超过 ${MAX_NAME_LEN} 个字符`
  if (/[<>{}]/.test(trimmed)) return '姓名包含非法字符'
  return null
}

function validateRole(role: unknown): string | null {
  if (typeof role !== 'string' || !role.trim()) return '角色不能为空'
  if (!(VALID_ROLES as readonly string[]).includes(role)) {
    return `角色必须是 ${VALID_ROLES.join('、')} 之一`
  }
  return null
}

function validateInviteKey(key: unknown): string | null {
  if (typeof key !== 'string' || !key.trim()) return '邀请密钥不能为空'
  const trimmed = key.trim()
  if (trimmed.length > MAX_KEY_LEN) return '邀请密钥格式不正确'
  return null
}

function validateDate(field: string, date: unknown): string | null {
  if (date === null || date === undefined || date === '') return null // 可选字段
  if (typeof date !== 'string' || !DATE_RE.test(date)) return `${field}格式不正确（YYYY-MM-DD）`
  const d = new Date(date + 'T00:00:00Z')
  if (isNaN(d.getTime())) return `${field}不是有效日期`
  return null
}

function validateDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && !end) return '请同时填写实习结束日期'
  if (!start && end) return '请同时填写实习开始日期'
  if (start && end && start > end) return '实习开始日期不能晚于结束日期'
  return null
}

// ── Token ──────────────────────────────────────────
function createToken(payload: { id: string; role: string; name: string; department?: string | null }) {
  const secret = process.env.JWT_SECRET || 'intern_nav_secret_key_2024'
  return jwt.sign(payload, secret as jwt.Secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  })
}

// ── POST /api/auth/register ─────────────────────────
router.post('/register', (req: Request, res: Response) => {
  try {
    const { email, password, name, role, inviteKey, department, internStartDate, internEndDate } = req.body ?? {}
    const missing: string[] = []
    if (!name) missing.push('姓名')
    if (!email) missing.push('邮箱')
    if (!password) missing.push('密码')
    if (!role) missing.push('角色')
    if (!inviteKey) missing.push('邀请密钥')
    if (missing.length > 0) {
      return res.status(400).json({ error: `缺少必填字段：${missing.join('、')}`, code: ErrCode.MISSING_FIELDS, fields: missing })
    }

    const trimmedRole = role.trim()

    // 实习生和导师必须选择部门
    if ((trimmedRole === 'intern' || trimmedRole === 'mentor') && (!department || !(department as string).trim())) {
      return res.status(400).json({ error: `${trimmedRole === 'intern' ? '实习生' : '导师'}必须选择部门`, code: ErrCode.MISSING_FIELDS, fields: ['department'] })
    }

    // 实习生验证实习时间
    const startDate = internStartDate?.trim() || null
    const endDate = internEndDate?.trim() || null
    if (trimmedRole === 'intern') {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: '实习生必须填写实习起止时间', code: ErrCode.MISSING_FIELDS, fields: ['internStartDate', 'internEndDate'] })
      }
      const sdErr = validateDate('实习开始日期', startDate)
      if (sdErr) return res.status(400).json({ error: sdErr, code: ErrCode.INVALID_NAME })
      const edErr = validateDate('实习结束日期', endDate)
      if (edErr) return res.status(400).json({ error: edErr, code: ErrCode.INVALID_NAME })
      const rangeErr = validateDateRange(startDate, endDate)
      if (rangeErr) return res.status(400).json({ error: rangeErr, code: ErrCode.INVALID_NAME })
    }

    const emailErr = validateEmail(email)
    if (emailErr) return res.status(400).json({ error: emailErr, code: ErrCode.INVALID_EMAIL })

    const pwErr = validatePassword(password)
    if (pwErr) return res.status(400).json({ error: pwErr, code: ErrCode.WEAK_PASSWORD })

    const nameErr = validateName(name)
    if (nameErr) return res.status(400).json({ error: nameErr, code: ErrCode.INVALID_NAME })

    const roleErr = validateRole(role)
    if (roleErr) return res.status(400).json({ error: roleErr, code: ErrCode.INVALID_ROLE })

    const keyErr = validateInviteKey(inviteKey)
    if (keyErr) return res.status(400).json({ error: keyErr, code: ErrCode.INVALID_KEY })

    const exists = db.prepare('SELECT id FROM users WHERE email = ?').all(email.trim().toLowerCase()) as any[]
    if (exists.length > 0) {
      return res.status(409).json({ error: '该邮箱已被注册', code: ErrCode.EMAIL_TAKEN })
    }

    const keyRows = db.prepare('SELECT * FROM invite_keys WHERE key_value = ?').all(inviteKey.trim()) as any[]
    if (keyRows.length === 0) {
      return res.status(400).json({ error: '邀请密钥不存在，请联系 HR 获取有效密钥', code: ErrCode.INVALID_KEY })
    }

    const keyRecord = keyRows[0]
    if (keyRecord.used_by !== null) {
      return res.status(400).json({ error: '该邀请密钥已被使用，请联系 HR 获取新密钥', code: ErrCode.KEY_ALREADY_USED })
    }

    if (keyRecord.role !== trimmedRole) {
      return res.status(400).json({
        error: `该密钥对应角色为「${keyRecord.role === 'intern' ? '实习生' : keyRecord.role === 'mentor' ? '导师' : 'HR'}」，与所选角色不匹配`,
        code: ErrCode.KEY_ROLE_MISMATCH,
      })
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    const userId = randomUUID()
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()
    const trimmedKey = inviteKey.trim()
    const trimmedDept = department?.trim() || null

    const insertUser = db.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, department, intern_start_date, intern_end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const markKey = db.prepare(
      `UPDATE invite_keys SET used_by = ?, used_at = datetime('now') WHERE key_value = ? AND used_by IS NULL`
    )

    const transaction = db.transaction(() => {
      insertUser.run(userId, normalizedEmail, passwordHash, trimmedName, trimmedRole, trimmedDept, startDate, endDate)
      const keyUpdateResult = markKey.run(userId, trimmedKey)
      if (keyUpdateResult.changes === 0) throw new Error('KEY_RACE_CONDITION')
    })

    try {
      transaction()
    } catch (txErr: any) {
      if (txErr.message === 'KEY_RACE_CONDITION') {
        return res.status(409).json({ error: '邀请密钥已被他人使用', code: ErrCode.KEY_ALREADY_USED })
      }
      throw txErr
    }

    const user = db.prepare(
      'SELECT id, role, name, email, department, intern_start_date, intern_end_date FROM users WHERE id = ?'
    ).get(userId) as any
    // 查询入职引导完成状态
    const onboardingRow = db.prepare('SELECT completed_at FROM onboarding_progress WHERE user_id = ?').get(userId) as any
    ;(user as any).onboarding_completed = !!onboardingRow?.completed_at

    const token = createToken({ id: user.id, role: user.role, name: user.name, department: user.department })
    res.status(201).json({ token, user })
  } catch (error: any) {
    console.error('[Register Error]', error)
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: '该邮箱已被注册', code: ErrCode.EMAIL_TAKEN })
    }
    return res.status(500).json({ error: '服务器内部错误', code: ErrCode.SERVER_ERROR })
  }
})

// ── POST /api/auth/login ───────────────────────────
router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {}
    if (!email || !password) return res.status(400).json({ error: '请输入邮箱和密码' })

    const user = db.prepare(
      'SELECT id, email, password_hash, role, name, department, intern_start_date, intern_end_date FROM users WHERE email = ?'
    ).get((email as string).trim().toLowerCase()) as any

    if (!user) return res.status(401).json({ error: '邮箱未注册' })
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: '密码错误' })

    // 查询入职引导完成状态
    const onboardingRow = db.prepare('SELECT completed_at FROM onboarding_progress WHERE user_id = ?').get(user.id) as any
    delete user.password_hash
    ;(user as any).onboarding_completed = !!onboardingRow?.completed_at

    const token = createToken({ id: user.id, role: user.role, name: user.name, department: user.department })
    res.json({ token, user })
  } catch {
    return res.status(500).json({ error: '服务器内部错误' })
  }
})

// ═══════════════════════════════════════════════════
//  邀请密钥管理（仅 HR）
// ═══════════════════════════════════════════════════

// ── GET /api/auth/keys ─────────────────────────────
router.get('/keys', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅 HR 可管理邀请密钥' })
  }

  const keys = db.prepare(
    `SELECT ik.*, u.name as used_by_name, u.email as used_by_email
     FROM invite_keys ik
     LEFT JOIN users u ON ik.used_by = u.id
     ORDER BY ik.created_at DESC`
  ).all()

  res.json(keys)
})

// ── POST /api/auth/keys ────────────────────────────
router.post('/keys', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅 HR 可创建邀请密钥' })
  }

  const { role, prefix, count } = req.body
  if (!role || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: '角色必须是 intern、mentor 或 hr' })
  }

  const countNum = Math.min(Math.max(parseInt(count) || 1, 1), 20)
  const keyPrefix = (prefix || role.toUpperCase()).replace(/[^A-Z0-9-]/g, '')

  const created: any[] = []

  const insertKey = db.prepare(
    "INSERT INTO invite_keys (id, key_value, role, created_at) VALUES (?, ?, ?, datetime('now', 'localtime'))"
  )

  const tx = db.transaction(() => {
    for (let i = 0; i < countNum; i++) {
      const suffix = Math.random().toString(36).substring(2, 8).toUpperCase()
      const keyValue = `${keyPrefix}-${suffix}`
      const id = randomUUID()
      insertKey.run(id, keyValue, role)
      created.push({ id, key_value: keyValue, role })
    }
  })
  tx()

  res.status(201).json({ created, count: created.length })
})

// ── DELETE /api/auth/keys/:id ──────────────────────
router.delete('/keys/:id', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: '仅 HR 可删除邀请密钥' })
  }

  const existing = db.prepare('SELECT * FROM invite_keys WHERE id = ?').get(req.params.id) as any
  if (!existing) return res.status(404).json({ error: '密钥不存在' })
  if (existing.used_by) {
    return res.status(400).json({ error: '该密钥已被使用，无法删除' })
  }

  db.prepare('DELETE FROM invite_keys WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
