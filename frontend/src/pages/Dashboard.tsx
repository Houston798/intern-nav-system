import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Badge, Card, EmptyState, SkeletonCard, Tabs, PageHeader, StatCard } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'
import type { Task, Skill, DepartmentTask } from '../types'

type TabKey = 'tasks' | 'skills' | 'deptTasks'

export default function Dashboard() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [tasks, setTasks] = useState<Task[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('tasks')
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [updatingTask, setUpdatingTask] = useState<string | null>(null)
  const [deptTasks, setDeptTasks] = useState<DepartmentTask[]>([])
  const [deptTasksLoading, setDeptTasksLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      setError('')
      try {
        const [tRes, sRes] = await Promise.all([
          api.get('/tasks'),
          api.get('/skills/me'),
        ])
        if (!cancelled) {
          setTasks(Array.isArray(tRes.data) ? tRes.data : [])
          setSkills(Array.isArray(sRes.data) ? sRes.data : [])
        }
      } catch {
        if (!cancelled) setError('数据获取失败，请确认后端服务已启动')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [user])

  // 部门任务加载（实习生可见）
  useEffect(() => {
    if (!user || user.role !== 'intern') return
    let cancelled = false
    fetchDeptTasks()
    return () => { cancelled = true }
    async function fetchDeptTasks() {
      setDeptTasksLoading(true)
      try {
        const res = await api.get('/department-tasks')
        if (!cancelled) setDeptTasks(res.data as DepartmentTask[])
      } catch { /* ignore */ }
      finally { if (!cancelled) setDeptTasksLoading(false) }
    }
  }, [user])

  const toggleTaskStatus = useCallback(async (task: Task) => {
    const newStatus = task.status === 'done' ? 'in_progress' : 'done'
    setUpdatingTask(task.id)
    try {
      await api.patch(`/tasks/${task.id}`, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t))
      addToast('success', newStatus === 'done' ? '任务已标记完成 ✅' : '任务已重新打开')
    } catch {
      addToast('error', '状态更新失败')
    } finally {
      setUpdatingTask(null)
    }
  }, [addToast])

  if (!user) {
    return <EmptyState icon="🔒" title="请先登录" description="登录后查看个人任务与技能进度" />
  }

  const statusLabels: Record<string, string> = {
    pending: '待处理', in_progress: '进行中', done: '已完成', overdue: '已逾期',
  }

  const doneCount = tasks.filter(t => t.status === 'done').length
  const skillProgress = skills.length > 0
    ? Math.round((skills.filter(s => s.status === 'mastered').length / skills.length) * 100)
    : 0

  return (
    <div className="page-enter space-y-6 pb-8">
      <PageHeader
        title="我的看板"
        subtitle={`${user.name} · ${user.department || '未分配部门'}${user.role === 'intern' ? ' · 实习阶段' : ''}`}
      />

      {/* ── Stat Cards ────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon="📋" label="全部任务" value={loading ? '…' : tasks.length} variant="primary" />
        <StatCard icon="✅" label="已完成" value={loading ? '…' : doneCount} variant="success" />
        <StatCard icon="🌱" label="技能掌握率" value={loading ? '…' : `${skillProgress}%`} variant="default" />
        <StatCard icon="🏢" label="部门任务" value={deptTasks.filter(t => t.status === 'active').length} variant="primary" />
      </div>

      {/* ── Error Banner ──────────────────── */}
      {error && (
        <div className="alert alert-error animate-scale-in" role="alert">
          <svg className="h-5 w-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-medium">加载失败</p>
            <p className="mt-0.5 text-rose-300/80 text-[0.8125rem]">{error}</p>
          </div>
        </div>
      )}

      {/* ── Tabs ──────────────────────────── */}
      <Tabs
        items={[
          { key: 'tasks', label: '任务列表', count: tasks.length },
          { key: 'skills', label: '技能树', count: skills.length },
          ...(user.role === 'intern' ? [{ key: 'deptTasks' as TabKey, label: '部门任务', count: deptTasks.filter(t => t.status === 'active').length }] : []),
        ]}
        active={activeTab}
        onChange={key => setActiveTab(key as TabKey)}
      />

      {/* ═══════════════════════════════════════
         Tasks Tab
         ═══════════════════════════════════════ */}
      {activeTab === 'tasks' && (
        <Card padding={false}>
          {loading ? (
            <div className="p-6"><SkeletonCard lines={5} /></div>
          ) : tasks.length > 0 ? (
            <ul className="divide-y divide-slate-800/50" role="list">
              {tasks.map(task => (
                <li key={task.id} className="group p-4 sm:p-5 transition hover:bg-slate-800/20">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTaskStatus(task)}
                      disabled={updatingTask === task.id}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.375rem] border-2 transition-all duration-200 ${
                        task.status === 'done'
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                          : 'border-slate-600 hover:border-slate-400 group-hover:border-slate-500'
                      }`}
                      aria-label={task.status === 'done' ? '标记未完成' : '标记完成'}
                    >
                      {updatingTask === task.id ? (
                        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : task.status === 'done' ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </button>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium truncate ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="mt-1 text-[0.8125rem] text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge label={statusLabels[task.status]} variant={task.status} />
                        <Badge label={task.priority === 'low' ? '低' : task.priority === 'medium' ? '中' : '高'} variant={task.priority as any} />
                        {task.due_date && (
                          <span className="text-[0.6875rem] text-slate-500">
                            截止：{new Date(task.due_date).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="📋" title="暂无任务" description="联系导师为你分配实习任务" />
          )}
        </Card>
      )}

      {/* ═══════════════════════════════════════
         Skills Tab
         ═══════════════════════════════════════ */}
      {activeTab === 'skills' && (
        <Card padding={false}>
          {loading ? (
            <div className="p-6"><SkeletonCard lines={4} /></div>
          ) : skills.length > 0 ? (
            <>
              {/* Overall Progress */}
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between text-[0.8125rem] mb-2">
                  <span className="text-slate-400 font-medium">整体进度</span>
                  <span className="font-semibold text-indigo-400">{skillProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
                  <div
                    className="progress-fill h-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    style={{ width: `${skillProgress}%` }}
                    role="progressbar"
                    aria-valuenow={skillProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>

              <ul className="divide-y divide-slate-800/50" role="list">
                {skills.map(skill => {
                  const pct = skill.status === 'mastered' ? 100 : skill.status === 'in_progress' ? 50 : 0
                  const isExpanded = expandedSkill === skill.id
                  return (
                    <li key={skill.id} className="transition hover:bg-slate-800/20">
                      <button
                        className="w-full p-4 sm:p-5 text-left"
                        onClick={() => setExpandedSkill(isExpanded ? null : skill.id)}
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                                skill.status === 'mastered'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : skill.status === 'in_progress'
                                  ? 'bg-indigo-500/15 text-indigo-400'
                                  : 'bg-slate-700/40 text-slate-500'
                              }`}
                            >
                              {skill.status === 'mastered' ? '✓' : skill.status === 'in_progress' ? '·' : '🔒'}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium truncate ${skill.status === 'locked' ? 'text-slate-500' : 'text-slate-200'}`}>
                                {skill.name}
                              </p>
                              <div className="mt-1.5 h-1.5 rounded-full bg-slate-700/50 overflow-hidden w-28 sm:w-40">
                                <div
                                  className="progress-fill h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <Badge
                            label={skill.status === 'mastered' ? '已掌握' : skill.status === 'in_progress' ? '学习中' : '未解锁'}
                            variant={skill.status as any}
                          />
                          <svg
                            className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>

                        {/* Expanded Detail */}
                        {isExpanded && (
                          <div className="mt-4 ml-11 rounded-xl bg-slate-800/40 border border-slate-700/30 p-4 animate-slide-in-left">
                            {skill.description && (
                              <p className="text-[0.8125rem] text-slate-400 leading-relaxed">{skill.description}</p>
                            )}
                            {skill.resources && skill.resources.length > 0 && (
                              <div className="mt-3">
                                <p className="text-[0.6875rem] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                  学习资源
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {skill.resources.map((r, i) => (
                                    <span
                                      key={i}
                                      className="rounded-lg bg-slate-700/50 px-3 py-1 text-xs text-slate-300"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <EmptyState icon="🌱" title="暂无技能树" description="联系 HR 或导师为你分配技能节点" />
          )}
        </Card>
      )}

      {/* ═══════════════════════════════════════
         Department Tasks Tab（实习生专用）
         ═══════════════════════════════════════ */}
      {activeTab === 'deptTasks' && user.role === 'intern' && (
        <Card padding={false}>
          {deptTasksLoading ? (
            <div className="p-6"><SkeletonCard lines={4} /></div>
          ) : deptTasks.filter(t => t.status === 'active').length > 0 ? (
            <>
              {/* 部门标题 */}
              <div className="px-6 pt-5 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 text-sm">🏢</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{user.department || '全部'}部 · 共享任务</p>
                    <p className="text-[0.6875rem] text-slate-500">同部门实习生的公共学习任务</p>
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-slate-800/50" role="list">
                {deptTasks.filter(t => t.status === 'active').map(task => (
                  <li key={task.id} className="group p-4 sm:p-5 transition hover:bg-slate-800/20">
                    <div className="flex items-start gap-3">
                      {/* Category icon */}
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        task.category === 'basic' ? 'bg-emerald-500/15 text-emerald-400'
                          : task.category === 'advanced' ? 'bg-violet-500/15 text-violet-400'
                          : 'bg-indigo-500/15 text-indigo-400'
                      }`}>
                        {task.category === 'basic' ? '🌱' : task.category === 'advanced' ? '🚀' : '🔧'}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{task.title}</p>
                          {task.skill_source_id && (
                            <span className="shrink-0 text-[0.55rem] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">技能树</span>
                          )}
                        </div>
                        {task.description && (
                          <p className="mt-1 text-[0.8125rem] text-slate-400 line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-medium ${
                            task.category === 'basic' ? 'bg-emerald-500/15 text-emerald-400'
                              : task.category === 'advanced' ? 'bg-violet-500/15 text-violet-400'
                              : 'bg-indigo-500/15 text-indigo-400'
                          }`}>
                            {task.category === 'basic' ? '基础素养' : task.category === 'advanced' ? '进阶业务' : '部门专精'}
                          </span>
                          {task.creator_name && (
                            <span className="text-[0.65rem] text-slate-600">由 {task.creator_name} 发布</span>
                          )}
                          {task.due_date && (
                            <span className="text-[0.65rem] text-amber-400/80">
                              📅 截止：{new Date(task.due_date).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Source indicator */}
                      <div className="shrink-0 text-right">
                        <span className="text-[0.65rem] text-slate-600">{new Date(task.created_at).toLocaleDateString('zh-CN')}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState icon="🏢" title="暂无部门共享任务" description={`${user.department || '当前'}部暂无公共任务，等待导师发布`} />
          )}
        </Card>
      )}
    </div>
  )
}
