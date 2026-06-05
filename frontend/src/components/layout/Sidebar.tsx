import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { UserRole } from '../../types'

interface NavSection {
  label?: string
  items: NavItem[]
}

type NavItem = {
  path: string
  label: string
  icon: string
  roles?: UserRole[]
}

const navSections: NavSection[] = [
  {
    items: [
      { path: '/', label: '首页', icon: '🏠' },
    ],
  },
  {
    label: '实习生',
    items: [
      { path: '/onboarding', label: '入职引导', icon: '🚀', roles: ['intern'] },
      { path: '/dashboard', label: '任务看板', icon: '📊', roles: ['intern'] },
    ],
  },
  {
    label: '导师',
    items: [
      { path: '/mentor', label: '导师工作台', icon: '🧑‍🏫', roles: ['mentor'] },
      { path: '/mentor/progress', label: '实习生进度', icon: '📈', roles: ['mentor'] },
    ],
  },
  {
    label: 'HR',
    items: [
      { path: '/hr', label: 'HR 管理中心', icon: '👔', roles: ['hr'] },
      { path: '/mentor/progress', label: '实习生进度', icon: '📈', roles: ['hr'] },
    ],
  },
  {
    label: '工具',
    items: [
      { path: '/skills', label: '技能中心', icon: '🌳' },
      { path: '/messages', label: '留言板', icon: '💬' },
      { path: '/ai-assistant', label: 'AI 助手', icon: '🤖' },
      { path: '/calendar', label: '日历', icon: '📅' },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onClose: () => void
}

export default function Sidebar({ collapsed, onClose }: SidebarProps) {
  const { user } = useAuth()

  return (
    <>
      {/* ── Mobile Overlay ────────────────── */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-slate-800/80 bg-[#020c1b]/95 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed
            ? '-translate-x-full lg:translate-x-0 lg:w-[--sidebar-collapsed]'
            : 'translate-x-0 w-64'
        }`}
        role="navigation"
        aria-label="主导航"
      >
        {/* ── Logo ──────────────────────────── */}
        <div
          className={`flex items-center border-b border-slate-800/50 transition-all ${
            collapsed ? 'lg:justify-center h-14' : 'h-14 px-4 gap-3'
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
            N
          </span>
          <span
            className={`text-sm font-semibold text-white whitespace-nowrap transition-opacity duration-200 ${
              collapsed ? 'lg:hidden opacity-0' : 'opacity-100'
            }`}
          >
            实习生导航
          </span>
        </div>

        {/* ── Navigation ────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 no-scrollbar">
          {navSections.map((section, si) => {
            const visibleItems = section.items.filter(item => {
              if (!user) return !item.roles
              if (!item.roles) return true
              return item.roles.includes(user.role)
            })
            if (visibleItems.length === 0) return null

            return (
              <div key={si} className="mb-1">
                {/* Section Header */}
                {section.label && !collapsed && (
                  <p className="px-4 pt-3 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {section.label}
                  </p>
                )}

                <ul className={`space-y-0.5 ${collapsed ? 'lg:px-2' : 'px-3'}`} role="list">
                  {visibleItems.map(item => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                          `group relative flex items-center rounded-lg transition-all duration-200 ${
                            collapsed ? 'lg:justify-center lg:px-2 lg:py-2.5' : 'px-3 py-2'
                          } ${
                            isActive
                              ? 'bg-indigo-500/10 text-indigo-300 font-medium'
                              : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-200'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Active indicator bar */}
                            {isActive && !collapsed && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-400" />
                            )}
                            {isActive && collapsed && (
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-indigo-400 lg:left-0.5" />
                            )}

                            {/* Icon */}
                            <span
                              className={`text-[1.1rem] shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                                collapsed ? '' : 'mr-3'
                              }`}
                              aria-hidden="true"
                            >
                              {item.icon}
                            </span>

                            {/* Label */}
                            <span
                              className={`text-[0.8125rem] transition-all duration-200 ${
                                collapsed ? 'lg:hidden opacity-0' : 'opacity-100'
                              }`}
                            >
                              {item.label}
                            </span>

                            {/* Active dot (collapsed) */}
                            {isActive && collapsed && (
                              <span className="absolute -right-0.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)] lg:block hidden" />
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* ── User Footer ────────────────────── */}
        {user && (
          <div className={`border-t border-slate-800/50 transition-all ${collapsed ? 'lg:p-2 lg:flex lg:justify-center' : 'p-3'}`}>
            <div
              className={`flex items-center rounded-xl bg-slate-800/40 border border-slate-700/30 transition-all ${
                collapsed ? 'lg:p-2 lg:justify-center' : 'p-2.5 gap-3'
              }`}
            >
              {/* Avatar */}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-md">
                {user.name.charAt(0)}
              </span>

              {/* User Info */}
              <div className={`min-w-0 flex-1 transition-all duration-200 ${collapsed ? 'lg:hidden opacity-0' : 'opacity-100'}`}>
                <p className="truncate text-[0.8125rem] font-medium text-white leading-tight">{user.name}</p>
                <p className="truncate text-[0.6875rem] text-slate-500 leading-tight mt-0.5">
                  {user.role === 'intern' ? '实习生' : user.role === 'mentor' ? '导师' : 'HR'}
                  {user.department ? ` · ${user.department}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
