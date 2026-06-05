import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, Badge } from '../components/ui/Card'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api'

/* ── 角色职能卡片（静态，仅路径） ────────── */
const roleCards = {
  intern: [
    { icon: '🚀', title: '入职引导', desc: '按步骤完成 6 步入职流程，快速融入团队', path: '/onboarding', badge: '实习第一步' },
    { icon: '📊', title: '任务看板', desc: '查看导师分配的任务，追踪完成进度', path: '/dashboard', badge: '我的一天' },
    { icon: '🌳', title: '技能成长', desc: '解锁业务技能树，掌握岗位核心能力', path: '/dashboard', badge: '持续进阶' },
    { icon: '🤖', title: 'AI 导师', desc: '遇到问题随时问，AI 按部门提供专属指导', path: '/ai-assistant' },
    { icon: '📅', title: '实习日历', desc: '关键节点一目了然，不再错过任何截止日', path: '/calendar' },
  ],
  mentor: [
    { icon: '👥', title: '实习生列表', desc: '查看每位实习生的任务进度与完成率', path: '/mentor' },
    { icon: '📋', title: '任务管理', desc: '分配任务、设定截止日期、追踪完成状态', path: '/mentor' },
    { icon: '💬', title: '消息通知', desc: '向学员发送提醒指导，接收进度预警', path: '/mentor' },
    { icon: '🤖', title: 'AI 助手', desc: '生成评估报告、答疑辅导建议', path: '/ai-assistant' },
    { icon: '📅', title: '实习日历', desc: '全局查看各学员的关键时间节点', path: '/calendar' },
  ],
  hr: [
    { icon: '📊', title: '全员看板', desc: '实习生与导师整体数据总览与统计', path: '/hr' },
    { icon: '🔑', title: '邀请管理', desc: '生成与分发邀请密钥，控制注册入口', path: '/hr' },
    { icon: '📋', title: '用户管理', desc: '查看和管理所有注册用户信息', path: '/hr' },
    { icon: '📢', title: '公告群发', desc: '向所有实习生/导师发送系统通知', path: '/hr' },
    { icon: '🤖', title: 'AI 助手', desc: '辅助撰写实习评估与总结报告', path: '/ai-assistant' },
  ],
}

type LiveStat = { icon: string; label: string; value: string; accent: string }

/* ── 快捷统计骨架 ────────────────────────── */
const SKELETON_STATS: LiveStat[] = [
  { icon: '⏳', label: '加载中…', value: '…', accent: 'slate' },
  { icon: '⏳', label: '加载中…', value: '…', accent: 'slate' },
  { icon: '⏳', label: '加载中…', value: '…', accent: 'slate' },
]

function Home() {
  const { user } = useAuth()
  const [liveStats, setLiveStats] = useState<LiveStat[]>([])
  const [loading, setLoading] = useState(false)

  /* ── 拉取真实数据构造快捷统计 ────────── */
  useEffect(() => {
    if (!user) { setLiveStats([]); return }
    setLoading(true)

    const fetchers: Promise<any>[] = [
      api.get('/users/stats').catch(() => ({ data: null })),
    ]

    if (user.role === 'mentor' || user.role === 'intern') {
      fetchers.push(api.get('/tasks/stats').catch(() => ({ data: null })))
    }
    if (user.role === 'mentor' || user.role === 'hr') {
      fetchers.push(api.get('/notifications').catch(() => ({ data: [] })))
    }

    Promise.all(fetchers).then(([uRes, tRes, nRes]) => {
      const us = uRes?.data || {}
      const ts = (tRes?.data) || {}
      const notifs: any[] = Array.isArray(nRes?.data) ? nRes.data : []

      let stats: LiveStat[] = []

      if (user.role === 'intern') {
        const total = ts.total ?? 0
        const done = ts.done ?? 0
        const inProgress = ts.inProgress ?? 0
        stats = [
          { icon: '📝', label: '全部任务', value: `${total} 项`, accent: 'indigo' },
          { icon: '✅', label: '已完成', value: `${done} 项`, accent: 'emerald' },
          { icon: '⏳', label: '进行中', value: `${inProgress} 项`, accent: 'amber' },
        ]
      } else if (user.role === 'mentor') {
        const myInterns = us.myInterns ?? 0
        const inProgress = ts.inProgress ?? 0
        const overdue = ts.overdue ?? 0
        const unread = notifs.filter((n: any) => !n.is_read).length
        stats = [
          { icon: '👥', label: '当前学员', value: `${myInterns} 位`, accent: 'indigo' },
          { icon: '📋', label: '进行中 / 逾期', value: `${inProgress} / ${overdue} 项`, accent: 'amber' },
          { icon: '🔔', label: '未读消息', value: `${unread} 条`, accent: 'rose' },
        ]
      } else if (user.role === 'hr') {
        const interns = us.byRole?.intern ?? 0
        const mentors = us.byRole?.mentor ?? 0
        const hrcount = us.byRole?.hr ?? 0
        stats = [
          { icon: '🎓', label: '在岗实习生', value: `${interns} 位`, accent: 'indigo' },
          { icon: '🧑‍🏫', label: '在职导师', value: `${mentors} 位`, accent: 'emerald' },
          { icon: '👔', label: 'HR 管理员', value: `${hrcount} 位`, accent: 'amber' },
        ]
      }

      setLiveStats(stats)
      setLoading(false)
    })
  }, [user])

  const cards = user ? (roleCards[user.role] || roleCards.intern) : roleCards.intern.slice(0, 4)
  const displayStats = liveStats.length > 0 ? liveStats : (loading ? SKELETON_STATS : [])

  const roleName = user
    ? user.role === 'intern' ? '实习生' : user.role === 'mentor' ? '导师' : 'HR'
    : ''

  return (
    <div className="page-enter space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-indigo-500/10 bg-gradient-to-br from-indigo-500/5 via-slate-900/90 to-slate-950 p-8 sm:p-10 lg:p-12">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-indigo-500/8 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-8 -bottom-8 h-48 w-48 rounded-full bg-purple-500/6 blur-3xl" aria-hidden="true" />

        <div className="relative">
          {user ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                {roleName} · {user.department || '业务部'}
              </span>
              <h1 className="mt-5 text-2xl font-bold text-white sm:text-3xl lg:text-4xl">
                欢迎回来，<span className="text-gradient">{user.name}</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
                {user.role === 'intern'
                  ? '查看今日任务，继续你的成长之路。'
                  : user.role === 'mentor'
                  ? '关注学员进度，及时给予指导与反馈。'
                  : '管理实习生全周期，掌握全局数据与动态。'}
              </p>
              <Link
                to={user.role === 'intern' ? '/dashboard' : user.role === 'mentor' ? '/mentor' : '/hr'}
                className="btn btn-primary btn-lg mt-6"
              >
                进入工作台
              </Link>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                实习生 · 导师 · HR 三角色协同
              </span>
              <h1 className="mt-5 text-2xl font-bold text-white sm:text-3xl lg:text-5xl">
                业务部
                <span className="text-gradient"> 实习生导航系统</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-slate-400 sm:text-lg">
                一站式实习生管理平台 —— 从注册入职到期满总结，
                覆盖任务追踪、技能成长、导师协作与 AI 辅助的全流程闭环。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/login" className="btn btn-primary btn-lg">立即登录</Link>
                <Link to="/register" className="btn btn-ghost btn-lg">注册账号</Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Quick Stats（实时数据） */}
      {user && displayStats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {displayStats.map((s, i) => {
            const accentMap: Record<string, string> = {
              indigo: 'border-indigo-500/20 bg-indigo-500/5',
              emerald: 'border-emerald-500/20 bg-emerald-500/5',
              amber: 'border-amber-500/20 bg-amber-500/5',
              rose: 'border-rose-500/20 bg-rose-500/5',
              slate: 'border-slate-500/20 bg-slate-500/5',
            }
            const iconMap: Record<string, string> = {
              indigo: 'text-indigo-400', emerald: 'text-emerald-400', amber: 'text-amber-400', rose: 'text-rose-400', slate: 'text-slate-500',
            }
            return (
              <Card key={i} className={`!p-4 !border ${accentMap[s.accent] || ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-lg ${iconMap[s.accent] || 'text-slate-400'}`} aria-hidden="true">{s.icon}</span>
                  <div>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-base font-semibold ${loading && s.value === '…' ? 'text-slate-600' : 'text-white'}`}>
                      {s.value}
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Role Feature Grid */}
      <section>
        <h2 className="mb-5 text-lg font-semibold text-white">
          {user ? `${roleName}工作台` : '核心功能'} — 选择你的角色
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((f, i) => (
            <Link key={i} to={f.path} className="group">
              <Card hover className="h-full cursor-pointer">
                <div className="flex items-start justify-between">
                  <CardHeader
                    title={f.title}
                    subtitle={f.desc}
                  />
                  {'badge' in f && (
                    <Badge label={(f as any).badge} variant="info" className="shrink-0" />
                  )}
                </div>
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 text-xs text-indigo-400 group-hover:text-indigo-300 transition">
                    立即前往 <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* 未登录：角色介绍 */}
      {!user && (
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              role: '实习生',
              icon: '🎓',
              desc: '完成入职引导、查看任务地图、解锁技能树、使用 AI 助手随时提问。',
              color: 'indigo',
            },
            {
              role: '导师',
              icon: '🧑‍🏫',
              desc: '查看学员看板、分配任务、接收进度预警、提供及时指导与反馈。',
              color: 'emerald',
            },
            {
              role: 'HR',
              icon: '👔',
              desc: '管理邀请密钥、查看全员数据、统计留用率、维护实习周期与档案。',
              color: 'amber',
            },
          ].map((item, i) => {
            const borderMap: Record<string, string> = {
              indigo: 'border-indigo-500/20',
              emerald: 'border-emerald-500/20',
              amber: 'border-amber-500/20',
            }
            return (
              <Card key={i} className={`text-center !p-6 !border ${borderMap[item.color]}`}>
                <span className="text-3xl" aria-hidden="true">{item.icon}</span>
                <h3 className="mt-3 font-semibold text-white">{item.role}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </Card>
            )
          })}
        </section>
      )}
    </div>
  )
}

export default Home
