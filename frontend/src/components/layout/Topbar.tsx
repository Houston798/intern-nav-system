import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../ui/Button'

interface TopbarProps {
  onMenuClick: () => void
  collapsed: boolean
}

export default function Topbar({ onMenuClick, collapsed }: TopbarProps) {
  const { user, logout } = useAuth()

  const roleConfig: Record<string, { label: string; className: string }> = {
    intern: { label: '实习生', className: 'badge-info' },
    mentor: { label: '导师', className: 'badge-success' },
    hr: { label: 'HR', className: 'badge-warning' },
  }

  const userRole = user ? (roleConfig[user.role] || roleConfig.intern) : null

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-800/70 bg-[#020617]/85 px-3 backdrop-blur-xl sm:px-5"
      role="banner"
    >
      {/* ── Left ────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        {/* Mobile Menu Toggle */}
        <button
          onClick={onMenuClick}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800/60 hover:text-white lg:hidden"
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          aria-expanded={!collapsed}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={onMenuClick}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800/60 hover:text-white lg:flex"
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开' : '收起'}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={collapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
            />
          </svg>
        </button>

        {/* Welcome */}
        {user && (
          <span className="hidden text-[0.8125rem] text-slate-500 sm:inline">
            欢迎回来，<span className="font-medium text-slate-300">{user.name}</span>
          </span>
        )}
        {!user && (
          <Link to="/login" className="hidden text-[0.8125rem] text-slate-500 hover:text-white transition sm:inline">
            请登录
          </Link>
        )}
      </div>

      {/* ── Right ────────────────────────────── */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            {/* Calendar quick link */}
            <Link
              to="/calendar"
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800/60 hover:text-white"
              aria-label="日历"
              title="日历"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </Link>

            {/* Role Badge */}
            {userRole && (
              <span className={`badge badge-dot hidden sm:inline-flex ${userRole.className} text-[0.6875rem]`}>
                {userRole.label}
              </span>
            )}

            {/* Logout */}
            <Button variant="ghost" size="sm" onClick={logout}>
              退出
            </Button>
          </>
        ) : (
          <div className="flex gap-2">
            <Link to="/login" className="btn btn-ghost btn-sm">登录</Link>
            <Link to="/register" className="btn btn-primary btn-sm">注册</Link>
          </div>
        )}
      </div>
    </header>
  )
}
