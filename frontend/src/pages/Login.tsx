import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Input } from '../components/ui/Form'
import Button from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'

function Login() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (user) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!email) errs.email = '请输入邮箱'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = '请输入有效的邮箱地址'
    if (!password) errs.password = '请输入密码'
    else if (password.length < 6) errs.password = '密码至少6个字符'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.success) navigate('/dashboard', { replace: true })
  }

  return (
    <div className="page-enter mx-auto flex min-h-[calc(100vh-10rem)] max-w-md items-center">
      <Card className="w-full !p-8">
        <CardHeader
          title="欢迎回来"
          subtitle="登录你的实习生导航系统账号"
        />
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <Input
            label="邮箱"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
            autoFocus
          />
          <Input
            label="密码"
            type="password"
            placeholder="输入密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
          />
          <Button type="submit" loading={loading} size="lg" className="w-full">
            登录
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          还没有账号？{' '}
          <Link to="/register" className="font-medium text-indigo-400 transition hover:text-indigo-300">
            立即注册
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default Login
