import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setAuthToken } from '../api'
import { useToast } from '../components/ui/Toast'
import type { User } from '../types'

type AuthContextType = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  register: (payload: {
    email: string
    password: string
    name: string
    role: string
    inviteKey: string
    department?: string
    internStartDate?: string
    internEndDate?: string
  }) => Promise<{ success: boolean; message: string; code?: string }>
  logout: () => void
  refreshOnboarding: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'intern_nav_auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { addToast } = useToast()

  /* ── 初始化：从 localStorage 恢复 ────── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { token: string; user: User }
        setUser(parsed.user)
        setToken(parsed.token)
        setAuthToken(parsed.token)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      setLoading(false)
    }
  }, [])

  /* ── 持久化 ──────────────────────────── */
  const persist = useCallback((tokenValue: string, userValue: User) => {
    setToken(tokenValue)
    setUser(userValue)
    setAuthToken(tokenValue)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: tokenValue, user: userValue }))
  }, [])

  /* ── 登录 ─────────────────────────────── */
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await api.post('/auth/login', { email, password })
        persist(response.data.token, response.data.user)
        addToast('success', '登录成功')
        return { success: true, message: '登录成功' }
      } catch (error: any) {
        const msg = error.response?.data?.error || '登录失败，请检查邮箱和密码'
        addToast('error', msg)
        return { success: false, message: msg }
      }
    },
    [persist, addToast]
  )

  /* ── 注册 ─────────────────────────────── */
  const register = useCallback(
    async (payload: {
      email: string
      password: string
      name: string
      role: string
      inviteKey: string
      department?: string
      internStartDate?: string
      internEndDate?: string
    }) => {
      try {
        const response = await api.post('/auth/register', payload)
        persist(response.data.token, response.data.user)
        addToast('success', '注册成功！欢迎加入')
        return { success: true, message: '注册成功' }
      } catch (error: any) {
        const data = error.response?.data
        const code = data?.code
        const msg = data?.error || '注册失败，请重试'
        // 仅在非网络错误时弹出 toast（网络错误由 Register 页面横幅处理）
        if (error.response) {
          addToast('error', msg)
        }
        return { success: false, message: msg, code }
      }
    },
    [persist, addToast]
  )

  /* ── 刷新入职引导状态 ──────────────────── */
  const refreshOnboarding = useCallback(async () => {
    try {
      const res = await api.get('/onboarding')
      const completed = !!res.data?.completed_at
      setUser((prev: User | null) => prev ? { ...prev, onboarding_completed: completed } : null)
      // 同步到 localStorage
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && user) {
        const parsed = JSON.parse(stored)
        parsed.user.onboarding_completed = completed
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  /* ── 退出 ─────────────────────────────── */
  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    setAuthToken(null)
    localStorage.removeItem(STORAGE_KEY)
    addToast('info', '已退出登录')
  }, [addToast])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
