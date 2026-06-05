import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Card, EmptyState, SkeletonCard, PageHeader, StatCard } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'
import type { MentorIntern, User } from '../types'

export default function MentorProgress() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [interns, setInterns] = useState<MentorIntern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [departments, setDepartments] = useState<string[]>([])

  // 导师列表
  const [mentors, setMentors] = useState<User[]>([])
  const [unassignedInterns, setUnassignedInterns] = useState<User[]>([])
  const [showMentorPanel, setShowMentorPanel] = useState(false)
  const [bindLoading, setBindLoading] = useState('')

  const canView = user?.role === 'mentor' || user?.role === 'hr'

  const fetchInterns = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/skills/mentor/interns')
      const data = res.data as MentorIntern[]
      setInterns(data)
      // 提取部门列表
      const depts = [...new Set(data.map(i => i.department).filter(Boolean))] as string[]
      setDepartments(depts)
    } catch (err: any) {
      setError(err?.response?.data?.error || '加载实习生列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInterns() }, [fetchInterns])

  // 获取导师列表
  const fetchMentors = async () => {
    try {
      const res = await api.get('/users/mentors')
      setMentors(res.data as User[])
    } catch { /* ignore */ }
  }

  // 获取未分配实习生
  const fetchUnassigned = async () => {
    try {
      const res = await api.get('/users/unassigned-interns')
      setUnassignedInterns(res.data as User[])
    } catch { /* ignore */ }
  }

  // HR 绑定实习主到导师
  const handleBindMentor = async (internId: string, mentorId: string) => {
    setBindLoading(internId)
    try {
      await api.put(`/users/${internId}/bind-mentor`, { mentorId })
      addToast('success', '绑定成功')
      fetchInterns()
      fetchUnassigned()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '绑定失败')
    } finally { setBindLoading('') }
  }

  const filtered = filterDept
    ? interns.filter(i => i.department === filterDept)
    : interns

  // 统计
  const allAvg = interns.length > 0
    ? Math.round(interns.reduce((s, i) => s + i.skillProgress.percent, 0) / interns.length)
    : 0
  const onTrack = interns.filter(i => i.skillProgress.percent >= 60).length

  if (!user) return <EmptyState icon="🔒" title="请先登录" />
  if (!canView) return <EmptyState icon="🚫" title="无权访问" description="仅导师和 HR 可查看实习生进度" />

  return (
    <div className="page-enter space-y-5 pb-8">
      <PageHeader title="实习生技能进度" subtitle={user.role === 'hr' ? '全局实习生技能掌握概览' : '查看所带实习生的学习进度'}>
        <div className="flex items-center gap-3">
          {user.role === 'hr' && (
            <button
              onClick={() => { setShowMentorPanel(!showMentorPanel); fetchMentors(); fetchUnassigned() }}
              className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-all ${showMentorPanel ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:bg-slate-800'}`}
            >
              👥 导师分配
            </button>
          )}
        </div>
        {departments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={() => setFilterDept('')}
              className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-all duration-200 ${
                !filterDept
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:text-slate-300'
              }`}
            >
              全部
            </button>
            {departments.map(d => (
              <button
                key={d}
                onClick={() => setFilterDept(d)}
                className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-all duration-200 ${
                  d === filterDept
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:bg-slate-800'
                }`}
              >
                {d}部
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {/* 导师分配面板（HR专属） */}
      {showMentorPanel && user.role === 'hr' && (
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4">👥 导师-实习生分配管理</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 导师列表 */}
            <div>
              <h4 className="text-[0.75rem] font-medium text-slate-400 mb-2 uppercase tracking-wider">按部门导师</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {mentors.length === 0 ? (
                  <p className="text-[0.75rem] text-slate-600">暂无导师数据</p>
                ) : (
                  [...new Set(mentors.map(m => m.department || '未分配'))].sort().map(dept => (
                    <div key={dept} className="mb-2">
                      <span className="inline-block rounded px-2 py-0.5 text-[0.65rem] font-medium bg-indigo-500/15 text-indigo-400 mb-1">{dept}部</span>
                      <div className="space-y-1 pl-1">
                        {mentors.filter(m => (m.department || '未分配') === dept).map(m => (
                          <div key={m.id} className="flex items-center gap-2 text-[0.75rem] text-slate-300 py-0.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-[0.6rem] font-bold text-white">{m.name.charAt(0)}</span>
                            {m.name}
                            <span className="text-[0.625rem] text-slate-600">{m.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 未分配实习生 */}
            <div>
              <h4 className="text-[0.75rem] font-medium text-slate-400 mb-2 uppercase tracking-wider">待分配实习生</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {unassignedInterns.length === 0 ? (
                  <p className="text-[0.75rem] text-slate-600">所有实习生已分配</p>
                ) : (
                  unassignedInterns.map(intern => (
                    <div key={intern.id} className="flex items-center justify-between gap-3 py-1 px-2 rounded-lg hover:bg-slate-800/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-[0.65rem] font-bold text-white">{intern.name.charAt(0)}</span>
                        <div className="min-w-0">
                          <p className="text-[0.75rem] text-slate-300 truncate">{intern.name}</p>
                          <p className="text-[0.6rem] text-slate-600">{intern.department || '无部门'}</p>
                        </div>
                      </div>
                      <select
                        value=""
                        onChange={e => { if (e.target.value) handleBindMentor(intern.id, e.target.value) }}
                        disabled={bindLoading === intern.id}
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[0.65rem] text-white focus:border-indigo-500 focus:outline-none shrink-0"
                      >
                        <option value="">绑定导师</option>
                        {mentors.filter(m => (m.department || '') === (intern.department || '')).map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 统计 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="👥" label="实习生总数" value={loading ? '…' : interns.length} variant="primary" />
        <StatCard icon="📊" label="平均掌握率" value={loading ? '…' : `${allAvg}%`} variant="default" />
        <StatCard icon="🎯" label={`达标 (>60%)`} value={loading ? '…' : onTrack} variant="success" />
      </div>

      {error && (
        <div className="alert alert-error animate-scale-in" role="alert">
          <p className="font-medium">加载失败</p>
          <p className="mt-0.5 text-rose-300/80 text-[0.8125rem]">{error}</p>
        </div>
      )}

      {/* 实习生列表 */}
      <Card padding={false}>
        {loading ? (
          <div className="p-6"><SkeletonCard lines={6} /></div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-slate-800/30">
            {filtered.map(intern => (
              <div
                key={intern.id}
                onClick={() => navigate(`/mentor/intern/${intern.id}`)}
                className="px-5 py-4 transition hover:bg-slate-800/20 cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* 左侧：姓名 + 部门 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                        {intern.name.charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                          {intern.name}
                        </p>
                        <p className="text-[0.6875rem] text-slate-500">
                          {intern.department || '未分配部门'} · {intern.intern_start_date || '-'} 入职
                        </p>
                      </div>
                    </div>
                  </div>

                    {/* 右侧：进度条 + 数字 */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:block text-right">
                      <div className="flex items-center gap-2">
                        <span className={`text-[0.625rem] px-1.5 py-0.5 rounded font-medium ${
                          intern.skillProgress.mastered > 0
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-slate-700/30 text-slate-500'
                        }`}>
                          已掌握 {intern.skillProgress.mastered}
                        </span>
                        {intern.skillProgress.inProgress > 0 && (
                          <span className="text-[0.625rem] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 font-medium">
                            学习中 {intern.skillProgress.inProgress}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[0.6875rem] text-slate-500">
                        {intern.skillProgress.total} 项技能
                        {intern.customTaskProgress && intern.customTaskProgress.total > 0 && (
                          <span className="ml-1.5 text-orange-400">+{intern.customTaskProgress.total} 自定义任务</span>
                        )}
                      </p>
                    </div>

                    {/* 进度条 */}
                    <div className="w-28 sm:w-36">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[0.625rem] text-slate-500">掌握率</span>
                        <span className={`text-[0.75rem] font-semibold ${
                          intern.skillProgress.percent >= 80
                            ? 'text-emerald-400'
                            : intern.skillProgress.percent >= 40
                            ? 'text-indigo-400'
                            : 'text-slate-400'
                        }`}>
                          {intern.skillProgress.percent}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700/40 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            intern.skillProgress.percent >= 80
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                              : intern.skillProgress.percent >= 40
                              ? 'bg-gradient-to-r from-indigo-500 to-indigo-400'
                              : 'bg-gradient-to-r from-slate-500 to-slate-400'
                          }`}
                          style={{ width: `${Math.max(intern.skillProgress.percent, 3)}%` }}
                        />
                      </div>
                    </div>

                    {/* 箭头 */}
                    <svg className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="📭" title="暂无实习生数据"
            description={user.role === 'mentor' ? '还没有分配到您名下的实习生' : '系统中尚无实习生'} />
        )}
      </Card>
    </div>
  )
}
