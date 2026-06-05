import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Badge, Card, CardHeader, EmptyState, SkeletonCard, Modal, StatCard, Tabs, ConfirmDialog } from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Form'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import type { InviteKey, Notification, User, UserStats, Task } from '../types'

/* ── 常量 ──────────────────────────────────────── */
const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  intern: { label: '实习生', color: 'indigo' },
  mentor: { label: '导师', color: 'emerald' },
  hr: { label: 'HR', color: 'amber' },
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function HRPanel() {
  const { user } = useAuth()
  const { addToast } = useToast()

  // ── Data ──
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [inviteKeys, setInviteKeys] = useState<InviteKey[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── UI State ──
  const [activeTab, setActiveTab] = useState('overview')
  const [userFilter, setUserFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')

  // ── Key Gen Form ──
  const [keyRole, setKeyRole] = useState('intern')
  const [keyPrefix, setKeyPrefix] = useState('')
  const [keyCount, setKeyCount] = useState(3)
  const [generating, setGenerating] = useState(false)

  // ── Broadcast Form ──
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [broadcast, setBroadcast] = useState({ title: '', content: '', target_role: 'intern' })
  const [broadcasting, setBroadcasting] = useState(false)

  // ── 删除确认 ──
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── 编辑用户 Modal ──
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', department: '', mbti_type: '', intern_type: '', intern_start_date: '', intern_end_date: '' })
  const [saving, setSaving] = useState(false)

  /* ── Data Fetching ───────────────────── */
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const [uRes, kRes, nRes, sRes, tRes] = await Promise.all([
        api.get('/users'),
        api.get('/auth/keys'),
        api.get('/notifications'),
        api.get('/users/stats'),
        api.get('/tasks'),
      ])
      setAllUsers(Array.isArray(uRes.data) ? uRes.data : [])
      setInviteKeys(Array.isArray(kRes.data) ? kRes.data : [])
      setNotifications(Array.isArray(nRes.data) ? nRes.data : [])
      setStats(sRes.data)
      setTasks(Array.isArray(tRes.data) ? tRes.data : [])
    } catch {
      setError('数据加载失败，确认后端已启动')
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  /* ── Computed ────────────────────────── */
  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      if (userFilter !== 'all' && u.role !== userFilter) return false
      if (userSearch) {
        const q = userSearch.toLowerCase()
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.department && u.department.toLowerCase().includes(q))
      }
      return true
    })
  }, [allUsers, userFilter, userSearch])

  /* ── Key Actions ─────────────────────── */
  const generateKeys = useCallback(async () => {
    setGenerating(true)
    try {
      const res = await api.post('/auth/keys', { role: keyRole, prefix: keyPrefix, count: keyCount })
      setInviteKeys(prev => [...res.data.created, ...prev])
      addToast('success', `已生成 ${res.data.count} 个 ${ROLE_LABELS[keyRole]?.label}密钥`)
      loadData() // refresh stats
    } catch {
      addToast('error', '生成密钥失败')
    } finally { setGenerating(false) }
  }, [keyRole, keyPrefix, keyCount, addToast, loadData])

  const revokeKey = useCallback(async (id: string) => {
    try {
      await api.delete(`/auth/keys/${id}`)
      setInviteKeys(prev => prev.filter(k => k.id !== id))
      addToast('info', '密钥已撤销')
      loadData()
    } catch {
      addToast('error', '撤销密钥失败（可能已被使用）')
    }
  }, [addToast, loadData])

  /* ── 删除用户 ─────────────────────── */
  const deleteUser = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.delete(`/users/${deleteTarget.id}`)
      setAllUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      addToast('success', res.data?.message || `已删除用户「${deleteTarget.name}」`)
      setDeleteTarget(null)
      loadData()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '删除失败')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, addToast, loadData])

  /* ── 打开编辑 Modal ───────────────── */
  const openEdit = useCallback((u: User) => {
    setEditTarget(u)
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      department: u.department || '',
      mbti_type: u.mbti_type || '',
      intern_type: u.intern_type || '',
      intern_start_date: u.intern_start_date || '',
      intern_end_date: u.intern_end_date || '',
    })
  }, [])

  /* ── 保存编辑 ─────────────────────── */
  const saveEdit = useCallback(async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      const payload: any = {}
      if (editForm.name !== editTarget.name) payload.name = editForm.name
      if (editForm.email !== editTarget.email) payload.email = editForm.email
      if (editForm.department !== (editTarget.department || '')) payload.department = editForm.department
      if (editForm.mbti_type !== (editTarget.mbti_type || '')) payload.mbti_type = editForm.mbti_type
      if (editTarget.role === 'intern' && editForm.intern_type !== (editTarget.intern_type || '')) payload.intern_type = editForm.intern_type
      if (editTarget.role === 'intern' && editForm.intern_start_date !== (editTarget.intern_start_date || '')) payload.intern_start_date = editForm.intern_start_date
      if (editTarget.role === 'intern' && editForm.intern_end_date !== (editTarget.intern_end_date || '')) payload.intern_end_date = editForm.intern_end_date

      if (Object.keys(payload).length === 0) {
        addToast('info', '没有需要保存的修改')
        setEditTarget(null)
        return
      }

      const res = await api.put(`/users/${editTarget.id}`, payload)
      setAllUsers(prev => prev.map(u => u.id === editTarget.id ? { ...u, ...res.data.user } : u))
      addToast('success', `已更新用户「${editTarget.name}」的信息`)
      setEditTarget(null)
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '保存失败')
    } finally {
      setSaving(false)
    }
  }, [editTarget, editForm, addToast])

  const sendBroadcast = useCallback(async () => {
    if (!broadcast.title.trim() || !broadcast.content.trim()) {
      addToast('error', '请填写标题和内容')
      return
    }
    setBroadcasting(true)
    try {
      const res = await api.post('/notifications/broadcast', {
        title: broadcast.title.trim(),
        content: broadcast.content.trim(),
        target_role: broadcast.target_role,
        type: 'announcement',
      })
      setShowBroadcastModal(false)
      setBroadcast({ title: '', content: '', target_role: 'intern' })
      addToast('success', `已向 ${res.data.sent} 位 ${ROLE_LABELS[broadcast.target_role]?.label} 发送公告`)
      loadData()
    } catch {
      addToast('error', '群发失败')
    } finally { setBroadcasting(false) }
  }, [broadcast, addToast, loadData])

  /* ── Guard ───────────────────────────── */
  if (!user) return <EmptyState icon="🔒" title="请先登录" />

  /* ═══════════════════════════════════════
     Render
     ═══════════════════════════════════════ */
  return (
    <div className="page-enter space-y-6 pb-8">
      {/* ── Header ───────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">HR 管理中心</h1>
          <p className="mt-1 text-sm text-slate-400">
            注册用户共 {stats?.total || '?'} 人 · 
            实习生 {stats?.byRole?.intern || 0} · 
            导师 {stats?.byRole?.mentor || 0} · 
            HR {stats?.byRole?.hr || 0}
            {stats?.todayNew ? ` · 今日新增 ${stats.todayNew}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={() => setShowBroadcastModal(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
            群发公告
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-300">{error}</div>}

      {/* ── Stat Cards ────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon="👥" label="注册总用户" value={loading ? '…' : stats?.total || 0} variant="primary" />
        <StatCard icon="🎓" label="实习生" value={loading ? '…' : stats?.byRole?.intern || 0} variant="primary" />
        <StatCard icon="🧑‍🏫" label="导师" value={loading ? '…' : stats?.byRole?.mentor || 0} variant="success" />
        <StatCard icon="👔" label="HR" value={loading ? '…' : stats?.byRole?.hr || 0} variant="warning" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="📅" label="今日新增" value={loading ? '…' : stats?.todayNew || 0} variant="default" />
        <StatCard icon="📈" label="本周新增" value={loading ? '…' : stats?.weeklyNew || 0} variant="default" />
        <StatCard icon="🔑" label="可用密钥" value={loading ? '…' : stats?.inviteStats?.available ?? 0} variant="warning" />
        <StatCard icon="📋" label="任务总数" value={loading ? '…' : tasks.length} variant="default" />
      </div>

      {/* ── Main Content ──────────────────── */}
      <Card padding={false}>
        <div className="px-6 pt-5">
          <Tabs
            items={[
              { key: 'overview', label: '数据总览', count: undefined as any },
              { key: 'users', label: '用户管理', count: allUsers.length },
              { key: 'keys', label: '邀请密钥', count: inviteKeys.length },
              { key: 'notifications', label: '通知中心', count: unreadCount },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* ── Overview Tab ─────────────────── */}
        {activeTab === 'overview' && (
          <div className="px-6 py-5">
            {loading ? <SkeletonCard lines={4} /> : stats ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {/* 角色分布 */}
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/20 p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">角色分布</h3>
                  <div className="space-y-3">
                    {['intern', 'mentor', 'hr'].map(r => {
                      const count = stats.byRole[r] || 0
                      const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                      const colors: Record<string, string> = { intern: 'indigo', mentor: 'emerald', hr: 'amber' }
                      return (
                        <div key={r}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[0.8125rem] text-slate-300">{ROLE_LABELS[r].label}</span>
                            <span className="text-[0.8125rem] font-medium text-white">{count} <span className="text-slate-500 text-[0.6875rem]">({pct}%)</span></span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700`}
                              style={{
                                width: `${pct}%`,
                                background: r === 'intern' ? 'linear-gradient(90deg, #6366f1, #818cf8)'
                                  : r === 'mentor' ? 'linear-gradient(90deg, #10b981, #34d399)'
                                  : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 部门分布 */}
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/20 p-4">
                  <h3 className="text-sm font-semibold text-white mb-4">部门分布</h3>
                  {stats.byDept && stats.byDept.length > 0 ? (
                    <div className="space-y-2">
                      {stats.byDept.slice(0, 8).map((d: any) => (
                        <div key={d.department} className="flex items-center gap-2">
                          <span className="text-[0.8125rem] text-slate-300 flex-1 truncate">{d.department}</span>
                          <Badge variant="info" label={String(d.count)} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[0.8125rem] text-slate-500">暂无部门数据</p>
                  )}
                </div>

                {/* 密钥概况 */}
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/20 p-4 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-white mb-4">密钥概况</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.inviteStats?.total || 0}</p>
                      <p className="text-[0.75rem] text-slate-500">总密钥</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-400">{stats.inviteStats?.used || 0}</p>
                      <p className="text-[0.75rem] text-slate-500">已使用</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-400">{stats.inviteStats?.available || 0}</p>
                      <p className="text-[0.75rem] text-slate-500">可用</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8"><EmptyState icon="📊" title="暂无统计数据" /></div>
            )}
          </div>
        )}

        {/* ── Users Tab ───────────────────── */}
        {activeTab === 'users' && (
          <div className="px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
              <input className="input text-[0.8125rem] w-full sm:w-48" placeholder="搜索姓名/邮箱/部门…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="input cursor-pointer text-[0.8125rem] w-28">
                <option value="all">全部角色</option>
                <option value="intern">实习生</option>
                <option value="mentor">导师</option>
                <option value="hr">HR</option>
              </select>
              <span className="text-[0.75rem] text-slate-500 sm:ml-auto">{filteredUsers.length} 人</span>
            </div>

            {loading ? <SkeletonCard lines={5} /> : filteredUsers.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[22%]">用户</th>
                      <th className="w-[10%]">角色</th>
                      <th className="w-[12%]">部门</th>
                      <th className="w-[8%]">MBTI</th>
                      <th className="w-[20%]">实习时间</th>
                      <th className="w-[16%]">注册时间</th>
                      <th className="w-[12%]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300 text-xs font-bold">{u.name.charAt(0)}</span>
                            <div className="min-w-0">
                              <p className="font-medium text-white text-[0.8125rem] truncate">{u.name}</p>
                              <p className="text-[0.6875rem] text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge variant={u.role === 'intern' ? 'info' : u.role === 'mentor' ? 'success' : 'warning'}
                            label={ROLE_LABELS[u.role]?.label || u.role} />
                        </td>
                        <td><span className="text-[0.8125rem] text-slate-400">{u.department || '—'}</span></td>
                        <td>
                          {u.mbti_type ? (
                            <span className="text-[0.8125rem] text-indigo-400 font-mono">{u.mbti_type}</span>
                          ) : <span className="text-[0.8125rem] text-slate-600">—</span>}
                        </td>
                        <td>
                          {u.role === 'intern' ? (
                            u.intern_start_date && u.intern_end_date ? (
                              <div className="flex items-center gap-1 text-[0.6875rem] text-slate-400">
                                <svg className="h-3 w-3 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{u.intern_start_date} ~ {u.intern_end_date}</span>
                              </div>
                            ) : (
                              <span className="text-[0.6875rem] text-amber-400/70">未填写</span>
                            )
                          ) : (
                            <span className="text-[0.6875rem] text-slate-600">—</span>
                          )}
                        </td>
                        <td className="text-[0.75rem] text-slate-500">
                          {u.created_at ? formatDateTime(u.created_at) : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-[0.75rem] text-indigo-400 hover:text-indigo-300 transition-colors"
                              onClick={() => openEdit(u)}
                              title="编辑用户信息"
                            >
                              编辑
                            </button>
                            <button
                              className="text-[0.75rem] text-rose-400 hover:text-rose-300 transition-colors"
                              onClick={() => setDeleteTarget(u)}
                              title="删除用户"
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8"><EmptyState icon="👤" title="暂无用户" description={userSearch ? '尝试其他搜索词' : '等待用户注册'} /></div>
            )}
          </div>
        )}

        {/* ── Invite Keys Tab ─────────────── */}
        {activeTab === 'keys' && (
          <div className="px-6 py-4">
            {/* Key Generator */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 mb-4">
              <h3 className="text-sm font-semibold text-white mb-3">生成邀请密钥</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[0.6875rem] text-slate-500 mb-1">角色</label>
                  <select value={keyRole} onChange={e => setKeyRole(e.target.value)} className="input cursor-pointer text-[0.8125rem]">
                    <option value="intern">实习生</option>
                    <option value="mentor">导师</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[0.6875rem] text-slate-500 mb-1">前缀 (可选)</label>
                  <input className="input text-[0.8125rem] w-32" placeholder="如: SUMMER" value={keyPrefix} onChange={e => setKeyPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} />
                </div>
                <div>
                  <label className="block text-[0.6875rem] text-slate-500 mb-1">数量</label>
                  <select value={keyCount} onChange={e => setKeyCount(Number(e.target.value))} className="input cursor-pointer text-[0.8125rem]">
                    {[1, 3, 5, 10, 15, 20].map(n => <option key={n} value={n}>{n} 个</option>)}
                  </select>
                </div>
                <button className="btn btn-primary btn-sm" onClick={generateKeys} disabled={generating}>
                  {generating ? '生成中…' : '生成密钥'}
                </button>
              </div>
            </div>

            {/* Key List */}
            {loading ? <SkeletonCard lines={3} /> : inviteKeys.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[28%]">密钥</th>
                      <th className="w-[12%]">角色</th>
                      <th className="w-[16%]">状态</th>
                      <th className="w-[16%]">使用者</th>
                      <th className="w-[16%]">使用时间</th>
                      <th className="w-[12%]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inviteKeys.map(k => (
                      <tr key={k.id}>
                        <td><code className="text-[0.8125rem] text-indigo-400 font-mono bg-slate-800/50 px-2 py-0.5 rounded">{k.key_value}</code></td>
                        <td><Badge variant={k.role === 'intern' ? 'info' : k.role === 'mentor' ? 'success' : 'warning'} label={ROLE_LABELS[k.role]?.label || k.role} /></td>
                        <td>{k.used_by ? <Badge variant="success" label="已使用" /> : <Badge variant="warning" label="可用" />}</td>
                        <td><span className="text-[0.8125rem] text-slate-300">{k.used_by_name || '—'}</span></td>
                        <td><span className="text-[0.75rem] text-slate-500">{k.used_at ? formatDateOnly(k.used_at) : '—'}</span></td>
                        <td>
                          {!k.used_by && (
                            <button onClick={() => revokeKey(k.id)} className="text-[0.75rem] text-rose-400 hover:text-rose-300">撤销</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8"><EmptyState icon="🔑" title="暂无密钥" description="点击上方生成第一组密钥" /></div>
            )}
          </div>
        )}

        {/* ── Notifications Tab ──────────── */}
        {activeTab === 'notifications' && (
          <div className="px-6 py-4">
            {loading ? <SkeletonCard lines={3} /> : notifications.length > 0 ? (
              <ul className="space-y-1">
                {notifications.map(item => (
                  <li key={item.id} className={`rounded-lg p-3.5 transition-all hover:bg-slate-800/30 ${item.is_read ? '' : 'border-l-2 border-indigo-500/50 bg-indigo-500/5'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[0.625rem] font-semibold uppercase tracking-[0.08em] ${item.is_read ? 'text-slate-600' : 'text-indigo-400'}`}>{item.type}</span>
                      {!item.is_read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />}
                    </div>
                    <p className={`text-[0.875rem] font-medium ${item.is_read ? 'text-slate-400' : 'text-white'}`}>{item.title}</p>
                    {item.content && <p className="mt-1 text-[0.75rem] text-slate-500 line-clamp-2">{item.content}</p>}
                    <p className="mt-1.5 text-[0.6875rem] text-slate-600">{formatDateTime(item.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8"><EmptyState icon="🔔" title="暂无通知" /></div>
            )}
          </div>
        )}
      </Card>

      {/* ═══════════════════════════════════════
         Broadcast Modal
         ═══════════════════════════════════════ */}
      <Modal open={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} title="群发公告" subtitle="向指定角色的所有用户发送系统公告" size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowBroadcastModal(false)} disabled={broadcasting}>取消</button>
            <button className="btn btn-primary" onClick={sendBroadcast} disabled={broadcasting}>
              {broadcasting && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              群发
            </button>
          </>
        }>
        <div className="space-y-4">
          <Select label="接收角色" value={broadcast.target_role} onChange={e => setBroadcast(p => ({ ...p, target_role: e.target.value }))}
            options={[
              { value: 'intern', label: `🎓 实习生 (${stats?.byRole?.intern || 0}人)` },
              { value: 'mentor', label: `🧑‍🏫 导师 (${stats?.byRole?.mentor || 0}人)` },
            ]} />
          <Input label="公告标题" required placeholder="例如：关于Q3实习考核安排的通知" value={broadcast.title}
            onChange={e => setBroadcast(p => ({ ...p, title: e.target.value }))} />
          <Textarea label="公告内容" required placeholder="输入公告正文…" value={broadcast.content}
            onChange={e => setBroadcast(p => ({ ...p, content: e.target.value }))} rows={4} maxLength={2000} showCount />
        </div>
      </Modal>

      {/* ═══════════════════════════════════════
         Delete Confirm Dialog
         ═══════════════════════════════════════ */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteUser}
        title="删除用户"
        message={
          deleteTarget
            ? `确定要删除「${deleteTarget.name}」（${ROLE_LABELS[deleteTarget.role]?.label}）吗？\n\n此操作将永久删除该用户的所有数据，包括任务、留言、通知、技能记录等。此操作不可恢复。`
            : ''
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        danger
        loading={deleting}
      />

      {/* ═══════════════════════════════════════
         Edit User Modal
         ═══════════════════════════════════════ */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="编辑用户信息"
        subtitle={editTarget ? `${editTarget.name} · ${ROLE_LABELS[editTarget.role]?.label}` : ''}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditTarget(null)} disabled={saving}>取消</button>
            <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
              {saving && (
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
          <div className="grid grid-cols-2 gap-3">
            <Input label="姓名" value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            <Input label="邮箱" type="email" value={editForm.email}
              onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="部门" value={editForm.department}
              onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
              placeholder="如：产品" />
            <Input label="MBTI" value={editForm.mbti_type}
              onChange={e => setEditForm(p => ({ ...p, mbti_type: e.target.value }))}
              placeholder="如：INTJ" />
          </div>

          {/* 实习生专有字段 */}
          {editTarget?.role === 'intern' && (
            <>
              <div className="border-t border-slate-700/50 pt-4">
                <h4 className="text-[0.8125rem] font-medium text-slate-300 mb-3">实习信息</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="实习类型"
                    value={editForm.intern_type}
                    onChange={e => setEditForm(p => ({ ...p, intern_type: e.target.value }))}
                    options={[
                      { value: '', label: '未设置' },
                      { value: 'summer', label: '暑期实习' },
                      { value: 'regular', label: '日常实习' },
                    ]}
                  />
                  <div />
                  <Input
                    label="实习开始日期"
                    type="date"
                    value={editForm.intern_start_date}
                    onChange={e => setEditForm(p => ({ ...p, intern_start_date: e.target.value }))}
                  />
                  <Input
                    label="实习结束日期"
                    type="date"
                    value={editForm.intern_end_date}
                    onChange={e => setEditForm(p => ({ ...p, intern_end_date: e.target.value }))}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
