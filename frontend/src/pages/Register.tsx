import { FormEvent, useState, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Input, Select } from '../components/ui/Form'
import Button from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'

// ── 密码强度级别 ────────────────────────────────────
type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong'

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; width: string }> = {
  empty:  { label: '',         color: 'bg-slate-600',  width: '0%' },
  weak:   { label: '弱',       color: 'bg-rose-500',   width: '25%' },
  fair:   { label: '一般',     color: 'bg-amber-500',  width: '50%' },
  good:   { label: '良好',     color: 'bg-emerald-400', width: '75%' },
  strong: { label: '强',       color: 'bg-emerald-500', width: '100%' },
}

function calcPasswordStrength(pw: string): StrengthLevel {
  if (!pw) return 'empty'
  if (pw.length < 8) return 'weak'
  let types = 0
  if (/[a-z]/.test(pw)) types++
  if (/[A-Z]/.test(pw)) types++
  if (/[0-9]/.test(pw)) types++
  if (/[^a-zA-Z0-9]/.test(pw)) types++
  if (types >= 4 && pw.length >= 12) return 'strong'
  if (types >= 3) return 'good'
  if (types >= 2) return 'fair'
  return 'weak'
}

// ── 表单字段定义 ────────────────────────────────────
type FieldName = 'name' | 'email' | 'password' | 'role' | 'inviteKey' | 'department' | 'internStartDate' | 'internEndDate'

type RegisterForm = Record<FieldName, string>

// ── 验证规则 ────────────────────────────────────────
function validateField(field: FieldName, value: string, form: RegisterForm): string | null {
  const trimmed = value.trim()
  switch (field) {
    case 'name':
      if (!trimmed) return '请输入姓名'
      if (trimmed.length > 64) return '姓名不能超过 64 个字符'
      if (/[<>{}]/.test(trimmed)) return '姓名包含非法字符'
      return null
    case 'email':
      if (!trimmed) return '请输入邮箱'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return '请输入有效的邮箱地址'
      if (trimmed.length > 255) return '邮箱长度不能超过 255 个字符'
      return null
    case 'password':
      if (!value) return '请输入密码'
      if (value.length < 8) return '密码至少需要 8 个字符'
      let types = 0
      if (/[a-z]/.test(value)) types++
      if (/[A-Z]/.test(value)) types++
      if (/[0-9]/.test(value)) types++
      if (/[^a-zA-Z0-9]/.test(value)) types++
      if (types < 2) return '密码需包含至少两种字符类型（大写字母、小写字母、数字、特殊符号）'
      return null
    case 'role':
      if (!['intern', 'mentor', 'hr'].includes(trimmed)) return '请选择有效角色'
      return null
    case 'inviteKey':
      if (!trimmed) return '请输入邀请密钥'
      return null
    case 'department':
      if (form.role === 'intern' && !trimmed) return '实习生必须选择部门'
      return null
    case 'internStartDate':
      if (form.role === 'intern' && !trimmed) return '请选择实习开始日期'
      if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return '日期格式不正确'
      return null
    case 'internEndDate':
      if (form.role === 'intern' && !trimmed) return '请选择实习结束日期'
      if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return '日期格式不正确'
      if (form.role === 'intern' && form.internStartDate && trimmed && trimmed < form.internStartDate) {
        return '结束日期不能早于开始日期'
      }
      return null
    default:
      return null
  }
}

// ── 服务端错误码 → 用户友好文案映射 ──────────────────
const SERVER_ERROR_MAP: Record<string, string> = {
  MISSING_FIELDS:        '请填写所有必填字段',
  INVALID_EMAIL:         '邮箱格式不正确',
  WEAK_PASSWORD:         '密码强度不足',
  INVALID_NAME:          '姓名格式不正确',
  INVALID_ROLE:          '角色选择无效',
  INVALID_INVITE_KEY:    '邀请密钥无效',
  KEY_ROLE_MISMATCH:     '邀请密钥与所选角色不匹配',
  KEY_ALREADY_USED:      '该邀请密钥已被使用',
  EMAIL_ALREADY_EXISTS:  '该邮箱已被注册',
  SERVER_ERROR:          '服务器繁忙，请稍后重试',
}

const ROLE_OPTIONS = [
  { value: 'intern', label: '实习生' },
  { value: 'mentor', label: '导师' },
  { value: 'hr', label: 'HR' },
]

const DEPT_OPTIONS = [
  { value: '', label: '请选择部门' },
  { value: '产品', label: '产品部' },
  { value: '运营', label: '运营部' },
  { value: '商务', label: '商务部' },
  { value: '技术', label: '技术部' },
  { value: '设计', label: '设计部' },
  { value: '市场', label: '市场部' },
  { value: '人力', label: '人力资源部' },
  { value: '财务', label: '财务部' },
  { value: '法务', label: '法务部' },
]

// ── 组件 ────────────────────────────────────────────
export default function Register() {
  const { register: doRegister, user } = useAuth()
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)

  const [form, setForm] = useState<RegisterForm>({
    name: '', email: '', password: '', role: 'intern', inviteKey: '',
    department: '', internStartDate: '', internEndDate: '',
  })
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitAttempts, setSubmitAttempts] = useState(0)

  // 已登录则跳转
  if (user) {
    navigate('/dashboard', { replace: true })
    return null
  }

  // ── 更新字段 + 实时校验（仅对已触碰过的字段） ────
  const update = (field: FieldName) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newValue = e.target.value
    setForm(prev => ({ ...prev, [field]: newValue }))
    // 清除服务端错误
    setServerError(null)
    // 如果该字段已被触碰过，实时更新校验结果
    setTouched(prev => {
      if (prev[field]) {
        const err = validateField(field, newValue, form)
        setErrors(prevErrs => ({ ...prevErrs, [field]: err || undefined }))
      }
      return prev
    })
  }

  // ── 失焦校验 ──────────────────────────────────
  const handleBlur = (field: FieldName) => () => {
    setTouched(prev => ({ ...prev, [field]: true }))
    const err = validateField(field, form[field], form)
    setErrors(prev => ({ ...prev, [field]: err || undefined }))
  }

  // ── 全量校验 ──────────────────────────────────
  const validateAll = useCallback((): boolean => {
    const fields: FieldName[] = ['name', 'email', 'password', 'role', 'inviteKey']
    if (form.role === 'intern') {
      fields.push('department', 'internStartDate', 'internEndDate')
    }
    const newErrors: Partial<Record<FieldName, string>> = {}
    const newTouched: Partial<Record<FieldName, boolean>> = {}
    let valid = true
    for (const f of fields) {
      newTouched[f] = true
      const err = validateField(f, form[f], form)
      if (err) {
        newErrors[f] = err
        valid = false
      }
    }
    setErrors(newErrors)
    setTouched(prev => ({ ...prev, ...newTouched }))
    return valid
  }, [form])

  // ── 提交 ──────────────────────────────────────
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setServerError(null)
    setSubmitAttempts(n => n + 1)

    if (!validateAll()) return

    setLoading(true)
    try {
      const result = await doRegister({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        inviteKey: form.inviteKey.trim(),
        department: form.role === 'intern' ? form.department.trim() : undefined,
        internStartDate: form.role === 'intern' ? form.internStartDate.trim() : undefined,
        internEndDate: form.role === 'intern' ? form.internEndDate.trim() : undefined,
      })

      if (result.success) {
        navigate('/onboarding', { replace: true })
      } else {
        // 服务端返回了错误信息
        handleServerError(result.code, result.message)
      }
    } catch (err: any) {
      // 网络级异常（超时、断网等）
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        setServerError('请求超时，请检查网络连接后重试')
      } else if (err?.message?.includes('Network Error') || !err?.response) {
        setServerError('网络连接失败，请检查后端服务是否已启动')
      } else {
        setServerError('网络异常，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── 服务端错误处理 ────────────────────────────
  const handleServerError = (code?: string, message?: string) => {
    // 优先使用错误码映射，其次使用原始消息
    const friendly = code ? SERVER_ERROR_MAP[code] || message : message
    setServerError(friendly || '注册失败，请重试')

    // 针对特定错误码，高亮对应字段
    if (code) {
      const fieldMap: Partial<Record<string, FieldName>> = {
        INVALID_EMAIL: 'email',
        EMAIL_ALREADY_EXISTS: 'email',
        WEAK_PASSWORD: 'password',
        INVALID_NAME: 'name',
        INVALID_ROLE: 'role',
        INVALID_INVITE_KEY: 'inviteKey',
        KEY_ROLE_MISMATCH: 'inviteKey',
        KEY_ALREADY_USED: 'inviteKey',
      }
      const targetField = fieldMap[code]
      if (targetField) {
        setTouched(prev => ({ ...prev, [targetField]: true }))
        setErrors(prev => ({ ...prev, [targetField]: friendly || undefined }))
      }
    }
  }

  // ── 密码强度 ──────────────────────────────────
  const strength = calcPasswordStrength(form.password)
  const strengthConfig = STRENGTH_CONFIG[strength]

  // ── 渲染 ──────────────────────────────────────
  return (
    <div className="page-enter mx-auto flex min-h-[calc(100vh-10rem)] max-w-md items-center">
      <Card className="w-full !p-8">
        <CardHeader
          title="创建账号"
          subtitle="选择角色并填入邀请密钥完成注册"
        />

        {/* 服务端/网络错误横幅 */}
        {serverError && (
          <div
            className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 animate-scale-in"
            role="alert"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-xs font-bold text-rose-300">
              ✕
            </span>
            <div className="flex-1">
              <p className="font-medium">注册失败</p>
              <p className="mt-0.5 text-rose-300/80">{serverError}</p>
              {submitAttempts >= 3 && (
                <p className="mt-1 text-xs text-rose-400/60">
                  多次尝试失败？请确认邀请密钥正确，或联系 HR 获取新的注册密钥。
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setServerError(null)}
              className="shrink-0 text-rose-400/60 hover:text-rose-300 transition"
              aria-label="关闭错误提示"
            >
              ✕
            </button>
          </div>
        )}

        <form ref={formRef} className="space-y-4" onSubmit={handleSubmit} noValidate>
          {/* 姓名 */}
          <Input
            label="姓名"
            placeholder="你的真实姓名"
            value={form.name}
            onChange={update('name')}
            onBlur={handleBlur('name')}
            error={touched.name ? errors.name : undefined}
            autoComplete="name"
            autoFocus
          />

          {/* 邮箱 */}
          <Input
            label="邮箱"
            type="email"
            placeholder="name@company.com"
            value={form.email}
            onChange={update('email')}
            onBlur={handleBlur('email')}
            error={touched.email ? errors.email : undefined}
            autoComplete="email"
          />

          {/* 密码 + 强度指示器 */}
          <div className="space-y-1.5">
            <Input
              label="密码"
              type="password"
              placeholder="至少 8 位，含大小写字母和数字"
              value={form.password}
              onChange={update('password')}
              onBlur={handleBlur('password')}
              error={touched.password ? errors.password : undefined}
              autoComplete="new-password"
            />
            {/* 密码强度条 */}
            {form.password.length > 0 && !errors.password && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strengthConfig.color}`}
                    style={{ width: strengthConfig.width }}
                  />
                </div>
                {strength !== 'empty' && (
                  <span className="text-xs text-slate-400 min-w-[2rem]">{strengthConfig.label}</span>
                )}
              </div>
            )}
            {/* 密码要求提示 */}
            {touched.password && strength === 'weak' && !errors.password && (
              <p className="text-xs text-amber-400/70">密码较弱，建议使用更复杂的组合</p>
            )}
          </div>

          {/* 角色 */}
          <Select
            label="角色"
            value={form.role}
            onChange={update('role')}
            onBlur={handleBlur('role')}
            error={touched.role ? errors.role : undefined}
            options={ROLE_OPTIONS}
          />

          {/* 邀请密钥 */}
          <Input
            label="邀请密钥"
            placeholder="由 HR 分发的注册密钥"
            value={form.inviteKey}
            onChange={update('inviteKey')}
            onBlur={handleBlur('inviteKey')}
            error={touched.inviteKey ? errors.inviteKey : undefined}
            hint={!touched.inviteKey || !errors.inviteKey ? '联系 HR 获取对应角色的邀请密钥' : undefined}
            autoComplete="off"
          />

          {/* 实习生专有字段 */}
          {form.role === 'intern' && (
            <>
              {/* 部门选择 */}
              <div className="space-y-1.5">
                <label className="text-[0.8125rem] font-medium text-slate-300">部门 *</label>
                <select
                  value={form.department}
                  onChange={update('department')}
                  onBlur={handleBlur('department')}
                  className={`input w-full cursor-pointer text-[0.8125rem] ${touched.department && errors.department ? 'border-rose-500/60 focus:border-rose-500' : ''}`}
                >
                  {DEPT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {touched.department && errors.department && (
                  <p className="text-[0.75rem] text-rose-400 mt-1">{errors.department}</p>
                )}
              </div>

              {/* 实习起止时间 */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="实习开始日期 *"
                  type="date"
                  value={form.internStartDate}
                  onChange={update('internStartDate')}
                  onBlur={handleBlur('internStartDate')}
                  error={touched.internStartDate ? errors.internStartDate : undefined}
                />
                <Input
                  label="实习结束日期 *"
                  type="date"
                  value={form.internEndDate}
                  onChange={update('internEndDate')}
                  onBlur={handleBlur('internEndDate')}
                  error={touched.internEndDate ? errors.internEndDate : undefined}
                />
              </div>
            </>
          )}

          {/* 提交按钮 */}
          <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
            注册
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          已有账号？{' '}
          <Link to="/login" className="font-medium text-indigo-400 transition hover:text-indigo-300">
            立即登录
          </Link>
        </p>
      </Card>
    </div>
  )
}
