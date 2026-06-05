import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import MentorPanel from './pages/MentorPanel'
import HRPanel from './pages/HRPanel'
import AiAssistant from './pages/AiAssistant'
import Calendar from './pages/Calendar'
import Onboarding from './pages/Onboarding'
import Messages from './pages/Messages'
import SkillManage from './pages/SkillManage'
import MentorProgress from './pages/MentorProgress'
import MentorInternDetail from './pages/MentorInternDetail'

/* ── 路由守卫 ──────────────────────────── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none" aria-label="加载中">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />
  }

  // 实习生必须先完成入职引导才能使用平台
  if (
    user.role === 'intern' &&
    !user.onboarding_completed &&
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

/* ── App ────────────────────────────────── */
function App() {
  const { loading } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const location = useLocation()

  useEffect(() => {
    setSidebarCollapsed(true)
  }, [location.pathname])

  const [displayLocation, setDisplayLocation] = useState(location)

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setDisplayLocation(location)
    }
  }, [location, displayLocation])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center animate-fade-slide-up">
          <div className="mx-auto h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <svg className="h-5 w-5 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="mt-4 text-sm text-slate-400">正在加载…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar collapsed={sidebarCollapsed} onClose={() => setSidebarCollapsed(true)} />
      <div className={`flex flex-1 flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
      }`}>
        <Topbar
          collapsed={sidebarCollapsed}
          onMenuClick={() => setSidebarCollapsed(prev => !prev)}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-indigo-500 focus:px-4 focus:py-2 focus:text-white"
        >
          跳转到主要内容
        </a>
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden" key={displayLocation.pathname}>
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Routes location={displayLocation}>
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/mentor" element={<ProtectedRoute><MentorPanel /></ProtectedRoute>} />
              <Route path="/hr" element={<ProtectedRoute><HRPanel /></ProtectedRoute>} />
              <Route path="/ai-assistant" element={<ProtectedRoute><AiAssistant /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/skills" element={<ProtectedRoute><SkillManage /></ProtectedRoute>} />
              <Route path="/mentor/progress" element={<ProtectedRoute><MentorProgress /></ProtectedRoute>} />
              <Route path="/mentor/intern/:internId" element={<ProtectedRoute><MentorInternDetail /></ProtectedRoute>} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
