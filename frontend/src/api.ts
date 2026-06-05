import axios, { AxiosError } from 'axios'

// 本地开发: vite proxy 将 /api/* → localhost:3001/api/*
// Vercel 生产: 同域 /api 路径由 serverless function 处理
// CloudBase: 直连 CloudRun 后端
const baseURL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.PROD ? '/api' : '/api')

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// ── 请求拦截 ────────────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('intern_nav_auth')
  if (token) {
    try {
      const parsed = JSON.parse(token)
      if (parsed.token) config.headers.Authorization = `Bearer ${parsed.token}`
    } catch { /* ignore */ }
  }
  return config
})

// ── 响应拦截 ────────────────────────────────────────
api.interceptors.response.use(
  response => response,
  (error: AxiosError<{ error?: string; code?: string; fields?: string[] }>) => {
    // 401 自动登出
    if (error.response?.status === 401) {
      const stored = localStorage.getItem('intern_nav_auth')
      if (stored) {
        localStorage.removeItem('intern_nav_auth')
        // 避免在登录/注册页面触发循环跳转
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login?expired=1'
        }
      }
    }

    // 网络超时：附加更友好的错误标记
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      ;(error as any).friendlyMessage = '请求超时，请检查网络连接后重试'
    } else if (!error.response) {
      ;(error as any).friendlyMessage = '无法连接服务器，请确认后端服务已启动'
    }

    return Promise.reject(error)
  },
)

// ── Token 设置 ──────────────────────────────────────
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}
