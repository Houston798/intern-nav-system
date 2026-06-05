import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Badge, Card, CardHeader, EmptyState, SkeletonCard, Modal, StatCard, Tabs } from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Form'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import type { Notification, Task, User, Contact, TaskStats as TStats } from '../types'

/* ── 工具函数 ──────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = { todo: '待办', pending: '待处理', in_progress: '进行中', done: '已完成' }
const PRIORITY_COLORS: Record<string, string> = { low: 'slate', medium: 'amber', high: 'orange', urgent: 'rose' }

function formatDate(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ── 导师面板内嵌留言速览组件 ──────────────────── */
function MentorMessagesPanel({ interns, navigate }: { interns: User[]; navigate: (path: string) => void }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/messages/contacts')
        setContacts(Array.isArray(res.data) ? res.data : [])
      } catch { /* ignore */ }
      setLoading(false)
    }
    load()
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-lg bg-slate-800/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (contacts.length === 0) {
    return <EmptyState icon="💬" title="暂无留言" description="实习生给你留言后会显示在这里" />
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[0.75rem] text-slate-500">
          {contacts.reduce((sum, c) => sum + c.unread, 0) > 0 && (
            <span className="text-indigo-400 font-medium">
              {contacts.reduce((sum, c) => sum + c.unread, 0)} 条未读 ·
            </span>
          )}{' '}
          点击进入完整对话
        </p>
        <button
          onClick={() => navigate('/messages')}
          className="text-[0.75rem] text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          打开留言板 →
        </button>
      </div>
      {contacts.map(contact => (
        <button
          key={contact.id}
          onClick={() => navigate('/messages')}
          className="w-full flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/30 p-3.5 hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all text-left"
        >
          <div className="relative shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
              {contact.name.charAt(0)}
            </span>
            {contact.unread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 flex items-center justify-center rounded-full bg-indigo-500 text-[0.6rem] font-bold text-white">
                {contact.unread > 99 ? '99+' : contact.unread}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{contact.name}</p>
            <p className="text-[0.6875rem] text-slate-500">
              {contact.department || '实习生'}
              {contact.unread > 0 && (
                <span className="ml-2 text-indigo-400">{contact.unread} 条新留言</span>
              )}
            </p>
          </div>
          <svg className="h-4 w-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function isOverdue(task: Task) {
  if (!task.due_date) return false
  if (task.status === 'done') return false
  return new Date(task.due_date) < new Date()
}

export default function MentorPanel() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  // ── Data ──
  const [interns, setInterns] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<TStats>({ total: 0, inProgress: 0, done: 0, overdue: 0, pending: 0 })
  const [userStats, setUserStats] = useState({ total: 0, internCount: 0, myInterns: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── UI State ──
  const [activeTab, setActiveTab] = useState('interns')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedInternId, setSelectedInternId] = useState('all')

  // ── 实习时间编辑 Modal ──
  const [editingIntern, setEditingIntern] = useState<User | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [savingDates, setSavingDates] = useState(false)

  // ── Forms ──
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as string, due_date: '', assignedTo: '' })
  const [newNotify, setNewNotify] = useState({ title: '', content: '', recipientIds: [] as string[] })
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)

  /* ── Data Fetching ───────────────────── */
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [iRes, tRes, nRes, sRes, usRes] = await Promise.all([
        api.get('/users?filter=intern'),
        api.get('/tasks'),
        api.get('/notifications'),
        api.get('/tasks/stats'),
        api.get('/users/stats'),
      ])
      setInterns(Array.isArray(iRes.data) ? iRes.data : [])
      setTasks(Array.isArray(tRes.data) ? tRes.data : [])
      setNotifications(Array.isArray(nRes.data) ? nRes.data : [])
      setStats(sRes.data)
      const us = usRes.data
      setUserStats({
        total: us.total || 0,
        internCount: us.byRole?.intern || 0,
        myInterns: us.myInterns || 0,
      })
    } catch {
      setError('数据加载失败，请确认后端服务已启动')
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  /* ── Computed ────────────────────────── */
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const filteredTasks = useMemo(() => tasks.filter(t => {
    const q = searchQuery.toLowerCase()
    if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (selectedInternId !== 'all' && t.assigned_to !== selectedInternId) return false
    return true
  }), [tasks, searchQuery, statusFilter, selectedInternId])

  const filteredInterns = useMemo(() => {
    if (searchQuery && activeTab === 'interns') {
      const q = searchQuery.toLowerCase()
      return interns.filter(i => i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q))
    }
    return interns
  }, [interns, searchQuery, activeTab])

  /* ── Actions ─────────────────────────── */
  const createTask = useCallback(async () => {
    if (!newTask.title.trim() || !newTask.assignedTo) {
      addToast('error', '请填写任务标题并选择负责人')
      return
    }
    setCreating(true)
    try {
      const res = await api.post('/tasks', {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        priority: newTask.priority,
        dueDate: newTask.due_date || null,
        assignedTo: newTask.assignedTo,
      })
      setTasks(prev => [res.data, ...prev])
      setShowCreateModal(false)
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assignedTo: '' })
      addToast('success', '任务已创建并通知负责人')
      loadData() // refresh stats
    } catch {
      addToast('error', '创建失败，请检查字段后重试')
    } finally { setCreating(false) }
  }, [newTask, addToast, loadData])

  const sendNotification = useCallback(async () => {
    if (!newNotify.title.trim() || !newNotify.content.trim() || newNotify.recipientIds.length === 0) {
      addToast('error', '请填写通知内容并选择接收人')
      return
    }
    setSending(true)
    try {
      await api.post('/notifications/send', {
        user_ids: newNotify.recipientIds,
        title: newNotify.title.trim(),
        content: newNotify.content.trim(),
        type: 'mentor_note',
      })
      setShowNotifyModal(false)
      setNewNotify({ title: '', content: '', recipientIds: [] })
      addToast('success', `已发送给 ${newNotify.recipientIds.length} 位实习生`)
      loadData()
    } catch {
      addToast('error', '发送失败，请重试')
    } finally { setSending(false) }
  }, [newNotify, addToast, loadData])

  const markRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/notifications/${id}`, { is_read: true })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    } catch { /* ignore */ }
  }, [])

  const deleteNotif = useCallback(async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications(prev => prev.filter(n => n.id !== id))
      addToast('info', '通知已删除')
    } catch { addToast('error', '删除失败') }
  }, [addToast])

  /* ── 打开实习时间编辑 Modal ────────── */
  const openEditDates = useCallback((intern: User) => {
    setEditingIntern(intern)
    setEditStartDate(intern.intern_start_date || '')
    setEditEndDate(intern.intern_end_date || '')
  }, [])

  /* ── 保存实习时间 ───────────────────── */
  const saveDates = useCallback(async () => {
    if (!editingIntern) return
    if (!editStartDate || !editEndDate) {
      addToast('error', '请填写完整的起止日期')
      return
    }
    if (editStartDate > editEndDate) {
      addToast('error', '开始日期不能晚于结束日期')
      return
    }
    setSavingDates(true)
    try {
      await api.put(`/users/${editingIntern.id}`, {
        intern_start_date: editStartDate,
        intern_end_date: editEndDate,
      })
      // 更新本地实习生列表
      setInterns(prev => prev.map(i =>
        i.id === editingIntern.id
          ? { ...i, intern_start_date: editStartDate, intern_end_date: editEndDate }
          : i
      ))
      addToast('success', `已更新 ${editingIntern.name} 的实习时间`)
      setEditingIntern(null)
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '更新失败')
    } finally {
      setSavingDates(false)
    }
  }, [editingIntern, editStartDate, editEndDate, addToast])

  const toggleInternSelect = (id: string) => {
    setNewNotify(prev => ({
      ...prev,
      recipientIds: prev.recipientIds.includes(id)
        ? prev.recipientIds.filter(rid => rid !== id)
        : [...prev.recipientIds, id],
    }))
  }

  /* ── Guard ───────────────────────────── */
  if (!user) return <EmptyState icon="🔒" title="请先登录" description="登录后查看导师视角" />

  /* ═══════════════════════════════════════
     Render
     ═══════════════════════════════════════ */
  return (
    <div className="page-enter space-y-6 pb-8">
      {/* ── Header ───────────────────────── */ }
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">导师工作台</h1>
          <p className="mt-1 text-sm text-slate-400">
            {userStats.myInterns > 0
              ? `管理 ${userStats.myInterns} 位实习生 · 共 ${stats.total} 项任务`
              : '尚无实习生 · 等待学员选择您为导师'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { setShowNotifyModal(true); setNewNotify({ title: '', content: '', recipientIds: [] }) }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            发送通知
          </Button>
          <Button size="sm" variant="primary" onClick={() => { setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assignedTo: '' }); setShowCreateModal(true) }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            分配任务
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {/* ── Stat Cards ────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard icon="👥" label="我的实习生" value={loading ? '…' : userStats.myInterns} variant="primary" />
        <StatCard icon="📋" label="管理任务" value={loading ? '…' : stats.total} variant="default" />
        <StatCard icon="⏳" label="进行中" value={loading ? '…' : stats.inProgress} variant="warning" />
        <StatCard icon="⚠️" label="已逾期" value={loading ? '…' : stats.overdue} variant={stats.overdue > 0 ? 'danger' : 'default'} />
        <StatCard icon="✅" label="已完成" value={loading ? '…' : stats.done} variant="success" />
      </div>

      {/* ── Main Content ──────────────────── */}
      <Card padding={false}>
        <div className="px-6 pt-5">
          <Tabs
            items={[
              { key: 'interns', label: '实习生列表', count: interns.length },
              { key: 'tasks', label: '任务看板', count: tasks.length },
              { key: 'messages', label: '留言板', count: null },
              { key: 'notifications', label: '消息中心', count: unreadCount },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* ── Interns Tab ─────────────────── */}
        {activeTab === 'interns' && (
          <div className="px-6 py-4">
            <div className="mb-4">
              <input
                className="input text-[0.8125rem] w-full sm:w-64"
                placeholder="搜索实习生姓名或邮箱…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {loading ? <SkeletonCard lines={3} /> : filteredInterns.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredInterns.map(intern => {
                  const internTasks = tasks.filter(t => t.assigned_to === intern.id)
                  const doneCount = internTasks.filter(t => t.status === 'done').length
                  const overdueCount = internTasks.filter(t => isOverdue(t)).length
                  const progressPercent = internTasks.length > 0 ? Math.round((doneCount / internTasks.length) * 100) : 0

                  return (
                    <div key={intern.id} className="group rounded-xl border border-slate-700/60 bg-slate-800/30 p-4 hover:border-indigo-500/30 hover:bg-slate-800/50 transition-all duration-200 cursor-pointer"
                      onClick={() => { setActiveTab('tasks'); setSelectedInternId(intern.id); setSearchQuery('') }}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300 text-sm font-bold border border-indigo-500/20">
                          {intern.name.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white text-[0.875rem] truncate">{intern.name}</p>
                          <p className="text-[0.6875rem] text-slate-500 truncate">{intern.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[0.75rem] text-slate-400 mb-2 flex-wrap">
                        {intern.department && <span className="bg-slate-700/50 px-2 py-0.5 rounded text-[0.6875rem]">{intern.department}</span>}
                        {intern.mbti_type && <span className="text-indigo-400 text-[0.6875rem]">{intern.mbti_type}</span>}
                      </div>

                      {/* 实习时间展示 */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-[0.6875rem] text-slate-500">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {intern.intern_start_date && intern.intern_end_date ? (
                            <span>
                              {intern.intern_start_date} ~ {intern.intern_end_date}
                            </span>
                          ) : (
                            <span className="text-amber-400/70">未填写实习时间</span>
                          )}
                        </div>
                        <button
                          className="text-[0.6875rem] text-indigo-400 hover:text-indigo-300 transition-colors"
                          onClick={e => { e.stopPropagation(); openEditDates(intern) }}
                          title="纠正实习时间"
                        >
                          纠正
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[0.75rem]">
                        <span className="text-slate-500">任务 {internTasks.length}</span>
                        <span className="text-slate-700">·</span>
                        <span className="text-emerald-400">完成 {doneCount}</span>
                        {overdueCount > 0 && (
                          <>
                            <span className="text-slate-700">·</span>
                            <span className="text-rose-400">逾期 {overdueCount}</span>
                          </>
                        )}
                      </div>

                      {/* Progress bar */}
                      {internTasks.length > 0 && (
                        <div className="mt-3 h-1 rounded-full bg-slate-700/50 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressPercent}%`,
                              background: progressPercent === 100
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #6366f1, #818cf8)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8">
                <EmptyState icon="👤" title="尚无实习生" description="等待实习生完成入职引导并选择您为导师" />
              </div>
            )}
          </div>
        )}

        {/* ── Tasks Tab ──────────────────── */}
        {activeTab === 'tasks' && (
          <div className="px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
              <input className="input text-[0.8125rem] w-full sm:w-48" placeholder="搜索任务…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input cursor-pointer text-[0.8125rem] w-28">
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="in_progress">进行中</option>
                <option value="done">已完成</option>
              </select>
              <select value={selectedInternId} onChange={e => setSelectedInternId(e.target.value)} className="input cursor-pointer text-[0.8125rem] w-36">
                <option value="all">全部实习生</option>
                {interns.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
              {(searchQuery || statusFilter !== 'all' || selectedInternId !== 'all') && (
                <button className="text-[0.75rem] text-indigo-400 hover:text-indigo-300" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSelectedInternId('all') }}>
                  清除筛选
                </button>
              )}
              <span className="text-[0.75rem] text-slate-500 sm:ml-auto">{filteredTasks.length} 条任务</span>
            </div>

            {loading ? <SkeletonCard lines={5} /> : filteredTasks.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[28%]">任务</th>
                      <th className="w-[14%]">负责人</th>
                      <th className="w-[10%]">优先级</th>
                      <th className="w-[12%]">状态</th>
                      <th className="w-[16%]">截止日期</th>
                      <th className="w-[20%]">创建时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(task => {
                      const overdue = isOverdue(task)
                      return (
                        <tr key={task.id} className={overdue ? 'bg-rose-500/5' : undefined}>
                          <td>
                            <div className="max-w-[220px]">
                              <p className="font-medium text-white text-[0.875rem] truncate">{task.title}</p>
                              {task.description && <p className="mt-0.5 text-[0.6875rem] text-slate-500 line-clamp-1">{task.description}</p>}
                            </div>
                          </td>
                          <td><span className="text-[0.8125rem] text-slate-300">{task.assigned_name || '—'}</span></td>
                          <td><Badge variant={task.priority as any} label={{ low: '低', medium: '中', high: '高', urgent: '紧急' }[task.priority]} /></td>
                          <td>
                            {overdue ? <Badge variant="danger" dot label="已逾期" /> : <Badge variant={task.status as any} label={STATUS_LABELS[task.status] || task.status} />}
                          </td>
                          <td>
                            {task.due_date ? (
                              <span className={`text-[0.8125rem] ${overdue ? 'text-rose-400 font-medium' : 'text-slate-400'}`}>{formatDate(task.due_date)}</span>
                            ) : <span className="text-[0.8125rem] text-slate-600">—</span>}
                          </td>
                          <td className="text-[0.75rem] text-slate-500">{formatDateTime(task.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8">
                <EmptyState icon="📋" title="暂无任务" description="点击右上角「分配任务」开始管理" />
              </div>
            )}
          </div>
        )}

        {/* ── Messages Tab ──────────────── */}
        {activeTab === 'messages' && (
          <div className="px-6 py-4">
            <MentorMessagesPanel interns={interns} navigate={navigate} />
          </div>
        )}

        {/* ── Notifications Tab ──────────── */}
        {activeTab === 'notifications' && (
          <div className="px-6 py-4">
            {loading ? <SkeletonCard lines={3} /> : notifications.length > 0 ? (
              <ul className="space-y-1">
                {notifications.map(item => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg p-3.5 transition-all hover:bg-slate-800/30">
                    <button className="flex-1 text-left" onClick={() => !item.is_read && markRead(item.id)}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.08em] ${item.is_read ? 'text-slate-600' : 'text-indigo-400'}`}>
                          {item.type}
                        </span>
                        {!item.is_read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />}
                      </div>
                      <p className={`text-[0.875rem] font-medium ${item.is_read ? 'text-slate-400' : 'text-white'}`}>{item.title}</p>
                      {item.content && <p className="mt-1 text-[0.75rem] text-slate-500 line-clamp-2">{item.content}</p>}
                    </button>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[0.6875rem] text-slate-600">{formatDateTime(item.created_at)}</span>
                      <button onClick={() => deleteNotif(item.id)} className="text-[0.6875rem] text-slate-600 hover:text-rose-400">删除</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8"><EmptyState icon="🔔" title="暂无通知" description="一切正常运转" /></div>
            )}
          </div>
        )}
      </Card>

      {/* ═══════════════════════════════════════
         Create Task Modal
         ═══════════════════════════════════════ */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="分配新任务" subtitle="为实习生创建任务并自动发送通知" size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} disabled={creating}>取消</button>
            <button className="btn btn-primary" onClick={createTask} disabled={creating}>
              {creating && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              创建并通知
            </button>
          </>
        }>
        <div className="space-y-4">
          <select
            className="input cursor-pointer text-[0.8125rem] w-full"
            value={newTask.assignedTo}
            onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
          >
            <option value="">选择负责人（实习生）</option>
            {interns.map(i => <option key={i.id} value={i.id}>{i.name} {i.department ? `· ${i.department}` : ''}</option>)}
          </select>
          <Input label="任务标题" required placeholder="例如：完成 Q3 市场调研报告" value={newTask.title}
            onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} autoFocus />
          <Textarea label="任务描述" placeholder="可选，补充说明任务要求…" value={newTask.description}
            onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} rows={3} maxLength={500} showCount />
          <div className="grid grid-cols-2 gap-4">
            <Select label="优先级" value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
              options={[
                { value: 'low', label: '🟢 低优先级' },
                { value: 'medium', label: '🟡 中优先级' },
                { value: 'high', label: '🟠 高优先级' },
                { value: 'urgent', label: '🔴 紧急' },
              ]} />
            <Input label="截止日期" type="date" value={newTask.due_date}
              onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════
         Send Notification Modal
         ═══════════════════════════════════════ */}
      <Modal open={showNotifyModal} onClose={() => setShowNotifyModal(false)} title="发送通知" subtitle="向你的实习生发送提醒或指导" size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowNotifyModal(false)} disabled={sending}>取消</button>
            <button className="btn btn-primary" onClick={sendNotification} disabled={sending}>
              {sending && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              发送 ({newNotify.recipientIds.length}人)
            </button>
          </>
        }>
        <div className="space-y-4">
          <div>
            <p className="text-[0.8125rem] font-medium text-slate-300 mb-2">接收人</p>
            {interns.length > 0 ? (
              <div className="space-y-1 max-h-36 overflow-y-auto rounded-lg border border-slate-700/50 p-2">
                {interns.map(intern => (
                  <label key={intern.id} className="flex items-center gap-2 rounded p-1.5 cursor-pointer hover:bg-slate-700/30 transition-colors">
                    <input type="checkbox" className="accent-indigo-500"
                      checked={newNotify.recipientIds.includes(intern.id)}
                      onChange={() => toggleInternSelect(intern.id)} />
                    <span className="text-[0.8125rem] text-slate-300">{intern.name}</span>
                    {intern.department && <span className="text-[0.6875rem] text-slate-500">· {intern.department}</span>}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[0.8125rem] text-slate-500 py-2">暂无实习生</p>
            )}
            {interns.length > 0 && (
              <div className="mt-2 flex gap-2">
                <button type="button" className="text-[0.75rem] text-indigo-400 hover:text-indigo-300"
                  onClick={() => setNewNotify(p => ({ ...p, recipientIds: interns.map(i => i.id) }))}>全选</button>
                <button type="button" className="text-[0.75rem] text-slate-500 hover:text-slate-400"
                  onClick={() => setNewNotify(p => ({ ...p, recipientIds: [] }))}>取消全选</button>
              </div>
            )}
          </div>
          <Input label="通知标题" required placeholder="例如：关于本周复盘会议的通知" value={newNotify.title}
            onChange={e => setNewNotify(p => ({ ...p, title: e.target.value }))} />
          <Textarea label="通知内容" required placeholder="输入通知正文…" value={newNotify.content}
            onChange={e => setNewNotify(p => ({ ...p, content: e.target.value }))} rows={4} maxLength={1000} showCount />
        </div>
      </Modal>

      {/* ═══════════════════════════════════════
         Edit Intern Dates Modal
         ═══════════════════════════════════════ */}
      <Modal
        open={!!editingIntern}
        onClose={() => setEditingIntern(null)}
        title="纠正实习时间"
        subtitle={editingIntern ? `${editingIntern.name} · ${editingIntern.department || '未分配部门'}` : ''}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditingIntern(null)} disabled={savingDates}>取消</button>
            <button className="btn btn-primary" onClick={saveDates} disabled={savingDates}>
              {savingDates && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              保存修改
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[0.8125rem] text-slate-400">
            如果实习生填写的实习时间有误，导师可以在此处进行纠正。修改后将立即同步至实习生档案。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-300 mb-1">实习开始日期 *</label>
              <input
                type="date"
                className="input w-full text-[0.8125rem]"
                value={editStartDate}
                onChange={e => setEditStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-300 mb-1">实习结束日期 *</label>
              <input
                type="date"
                className="input w-full text-[0.8125rem]"
                value={editEndDate}
                onChange={e => setEditEndDate(e.target.value)}
              />
            </div>
          </div>
          {editStartDate && editEndDate && editStartDate > editEndDate && (
            <p className="text-[0.75rem] text-rose-400">⚠ 开始日期不能晚于结束日期</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
