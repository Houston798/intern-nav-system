import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Card, EmptyState, SkeletonCard, Badge } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'
import type { MentorInternDetail, SkillTreeNode, SkillFeedback, SkillGrouped, MentorTask, PublishTaskResult } from '../types'

/* ── 分类配置 ─────────────────────── */
const CATEGORY_META = {
  basic:       { label: '基础素养', icon: '🌱', color: 'emerald' },
  department:  { label: '部门专精', icon: '🔧', color: 'indigo' },
  advanced:    { label: '进阶业务', icon: '🚀', color: 'violet' },
} as const

type CategoryKey = keyof typeof CATEGORY_META

/* ── 模态框组件 ─────────────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700/50 shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function gatherLeafNodes(nodes: SkillTreeNode[]): SkillTreeNode[] {
  const leaves: SkillTreeNode[] = []
  const walk = (list: SkillTreeNode[]) => {
    list.forEach(n => {
      if (n.children.length === 0) leaves.push(n)
      else walk(n.children)
    })
  }
  walk(nodes)
  return leaves
}

export default function MentorInternDetail() {
  const { internId } = useParams<{ internId: string }>()
  const { user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [data, setData] = useState<MentorInternDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('basic')
  const [activeTab, setActiveTab] = useState<'skills' | 'tasks'>('skills')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 反馈表单
  const [feedbackSkill, setFeedbackSkill] = useState<SkillTreeNode | null>(null)
  const [feedbackContent, setFeedbackContent] = useState('')
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  // 自定义任务表单
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<MentorTask | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'department' as 'basic' | 'department' | 'advanced',
    due_date: '',
    order_index: 0,
  })
  const [savingTask, setSavingTask] = useState(false)
  const [customTasks, setCustomTasks] = useState<MentorTask[]>([])

  // 技能树发布任务
  const [publishSelections, setPublishSelections] = useState<Set<string>>(new Set())
  const [publishMode, setPublishMode] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishDueDate, setPublishDueDate] = useState('')
  const [publishScope, setPublishScope] = useState<'personal' | 'department'>('personal')

  const canView = user?.role === 'mentor' || user?.role === 'hr'

  const fetchDetail = useCallback(async () => {
    if (!internId) return
    setLoading(true)
    setError('')
    try {
      const res = await api.get<MentorInternDetail>(`/skills/mentor/intern/${internId}`)
      const d = res.data
      setData(d)
      setCustomTasks(d.customTasks || [])

      // 展开有状态的节点
      const ids = new Set<string>()
      d.grouped?.forEach(g => {
        g.nodes.forEach(n => {
          ids.add(n.id)
          if (n.children.some(c => c.status !== 'locked')) ids.add(n.id)
        })
      })
      setExpandedIds(ids)

      // 第一个有内容的分类
      const first = (['basic', 'department', 'advanced'] as CategoryKey[])
        .find(k => d.grouped?.find(g => g.category === k)?.nodes.length)
      if (first) setActiveCategory(first)
    } catch (err: any) {
      setError(err?.response?.data?.error || '加载实习生技能详情失败')
    } finally {
      setLoading(false)
    }
  }, [internId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── 反馈提交 ──
  const submitFeedback = async () => {
    if (!feedbackSkill || !feedbackContent.trim()) {
      addToast('warning', '请输入反馈内容')
      return
    }
    setSubmittingFeedback(true)
    try {
      await api.post('/skills/feedback', {
        internId,
        skillId: feedbackSkill.id,
        content: feedbackContent.trim(),
        rating: feedbackRating,
      })
      addToast('success', '反馈已提交')
      setFeedbackSkill(null)
      setFeedbackContent('')
      setFeedbackRating(0)
      fetchDetail()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '提交失败')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  // ── 自定义任务 CRUD ──
  const openCreateTask = () => {
    setEditingTask(null)
    setTaskForm({ title: '', description: '', category: 'department', due_date: '', order_index: 0 })
    setShowTaskModal(true)
  }

  const openEditTask = (task: MentorTask) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      category: task.category,
      due_date: task.due_date || '',
      order_index: task.order_index,
    })
    setShowTaskModal(true)
  }

  const handleTaskSubmit = async () => {
    if (!taskForm.title.trim()) { addToast('error', '请输入任务标题'); return }
    setSavingTask(true)
    try {
      if (editingTask) {
        await api.put(`/mentor-tasks/${editingTask.id}`, {
          title: taskForm.title.trim(),
          description: taskForm.description,
          category: taskForm.category,
          due_date: taskForm.due_date || null,
          order_index: taskForm.order_index,
        })
        addToast('success', '任务已更新')
      } else {
        await api.post('/mentor-tasks', {
          internId,
          title: taskForm.title.trim(),
          description: taskForm.description,
          category: taskForm.category,
          due_date: taskForm.due_date || null,
          order_index: taskForm.order_index,
        })
        addToast('success', '任务已创建')
      }
      setShowTaskModal(false)
      fetchDetail()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '操作失败')
    } finally {
      setSavingTask(false)
    }
  }

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`确定删除任务「${title}」吗？此操作不可撤销。`)) return
    try {
      await api.delete(`/mentor-tasks/${taskId}`)
      addToast('success', `已删除「${title}」`)
      fetchDetail()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '删除失败')
    }
  }

  // 快速更新任务状态
  const handleTaskStatus = async (taskId: string, status: string) => {
    try {
      await api.put(`/mentor-tasks/${taskId}`, { status })
      fetchDetail()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '状态更新失败')
    }
  }

  // ── 技能树节点发布为任务 ──
  const handlePublishTasks = async () => {
    const skillIds = [...publishSelections]
    if (skillIds.length === 0) {
      addToast('warning', '请先勾选要发布的技能节点')
      return
    }
    setPublishing(true)
    try {
      const payload: any = {
        skillIds,
        due_date: publishDueDate || null,
        scope: publishScope,
      }
      
      if (publishScope === 'personal') {
        payload.internId = internId
      } else {
        // 部门共享模式：需要指定部门
        payload.department = data.intern.department
        payload.internId = internId // skills.ts 中部门模式也需要知道来源
      }

      const res = await api.post<PublishTaskResult>('/skills/publish-tasks', payload)
      addToast('success', res.data.message || `成功发布 ${res.data.created} 个任务`)
      setPublishSelections(new Set())
      setPublishMode(false)
      setPublishDueDate('')
      setPublishScope('personal')
      fetchDetail()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  const handleBatchPublish = (nodes: SkillTreeNode[]) => {
    const leaves = gatherLeafNodes(nodes)
    setPublishSelections(new Set(leaves.map(n => n.id)))
    setPublishMode(true)
  }

  const togglePublishSelect = (id: string) => {
    setPublishSelections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── 渲染技能节点 (导师视图，带反馈入口) ──
  const renderNode = (node: SkillTreeNode, depth: number) => {
    const isExpanded = expandedIds.has(node.id)
    const hasChildren = node.children.length > 0
    const isLeaf = !hasChildren

    const statusConfig = {
      mastered:    { bg: 'bg-emerald-500/8', border: 'border-emerald-500/15', icon: '✓', iconBg: 'bg-emerald-500/20', iconText: 'text-emerald-400' },
      in_progress: { bg: 'bg-indigo-500/8', border: 'border-indigo-500/15', icon: '▶', iconBg: 'bg-indigo-500/20', iconText: 'text-indigo-400' },
      locked:      { bg: 'bg-slate-800/20', border: 'border-slate-700/20', icon: '○', iconBg: 'bg-slate-700/30', iconText: 'text-slate-500' },
    }
    const cfg = statusConfig[node.status] || statusConfig.locked
    const nodeFeedbacks = data?.feedbacks?.filter(f => f.skill_id === node.id) || []

    return (
      <div key={node.id} className="animate-fade-slide-up" style={{ animationDelay: `${depth * 30}ms` }}>
        <div
          className={`group relative rounded-xl border transition-all duration-200 mb-1.5 ${cfg.bg} ${cfg.border}`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            {hasChildren ? (
              <button onClick={() => toggleExpand(node.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-700/40 hover:bg-slate-700 transition-colors">
                <svg className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : <span className="w-5" />}

            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[0.625rem] font-bold ${cfg.iconBg} ${cfg.iconText}`}>
              {cfg.icon}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[0.8125rem] font-medium truncate ${hasChildren ? 'text-white' : 'text-slate-200'}`}>
                  {node.name}
                </span>
                <Badge
                  label={node.status === 'mastered' ? '已掌握' : node.status === 'in_progress' ? '学习中' : '未开始'}
                  variant={node.status === 'mastered' ? 'success' : node.status === 'in_progress' ? 'primary' : 'default'}
                />
              </div>
            </div>

            {/* 反馈入口(叶子节点) 或 发布勾选 */}
            {isLeaf && (
              <div className="flex items-center gap-1.5 shrink-0">
                {publishMode ? (
                  <input
                    type="checkbox"
                    checked={publishSelections.has(node.id)}
                    onChange={(e) => { e.stopPropagation(); togglePublishSelect(node.id) }}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                  />
                ) : (
                  <>
                    {nodeFeedbacks.length > 0 && (
                      <span className="text-[0.625rem] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                        {nodeFeedbacks.length} 条反馈
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setFeedbackSkill(node) }}
                      className="rounded-lg px-2 py-1 text-[0.625rem] font-medium bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
                      title="添加反馈"
                    >
                      💬 反馈
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {isExpanded && (
          <div>
            {hasChildren && node.children.map(c => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!user) return <EmptyState icon="🔒" title="请先登录" />
  if (!canView) return <EmptyState icon="🚫" title="无权访问" />

  return (
    <div className="page-enter space-y-5 pb-8">
      {/* 返回 + 头部 */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/mentor/progress')}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">
            {data?.intern.name || '实习生详情'}
          </h1>
          {data?.intern.department && (
            <p className="text-[0.75rem] text-slate-500">{data.intern.department}部 · {data.intern.email}</p>
          )}
        </div>
      </div>

      {loading ? (
        <Card><SkeletonCard lines={8} /></Card>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : data && data.intern.department ? (
        <>
          {/* ── 标签页切换：技能树 / 自定义任务 ── */}
          <div className="flex gap-1 border-b border-slate-800/50 pb-0">
            <TabButton
              active={activeTab === 'skills'}
              onClick={() => setActiveTab('skills')}
              icon="🌳"
              label="技能树"
            />
            <TabButton
              active={activeTab === 'tasks'}
              onClick={() => setActiveTab('tasks')}
              icon="📋"
              label={`自定义任务 (${customTasks.length})`}
            />
          </div>

          {activeTab === 'skills' ? (
            <>
              {/* 分类标签 */}
              <div className="flex gap-2 items-end">
                {(Object.keys(CATEGORY_META) as CategoryKey[]).map(key => {
                  const meta = CATEGORY_META[key]
                  const catNodes = data.grouped?.find(g => g.category === key)?.nodes || []
                  const leaves = gatherLeafNodes(catNodes)
                  const mastered = leaves.filter(n => n.status === 'mastered').length
                  const progress = leaves.length > 0 ? Math.round((mastered / leaves.length) * 100) : 0
                  return (
                    <button key={key} onClick={() => setActiveCategory(key)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[0.8125rem] font-medium transition-all duration-200 border-b-2 ${
                        activeCategory === key
                          ? `bg-${meta.color}-500/10 text-${meta.color}-400 border-${meta.color}-500/30 -mb-px`
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 border-transparent'
                      }`}>
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      {progress > 0 && (
                        <span className={`text-[0.625rem] px-1.5 py-0.5 rounded-full bg-${meta.color}-500/15 text-${meta.color}-400`}>
                          {progress}%
                        </span>
                      )}
                    </button>
                  )
                })}

                {/* 发布任务按钮 */}
                <div className="ml-auto mb-0.5 flex items-center gap-2">
                  {publishMode ? (
                    <div className="flex items-center gap-2">
                      {/* 发布范围切换 */}
                      <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                        <button
                          onClick={() => setPublishScope('personal')}
                          className={`px-2 py-1.5 text-[0.65rem] font-medium transition-colors ${
                            publishScope === 'personal'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-slate-800/40 text-slate-500 hover:text-slate-400'
                          }`}
                          title="仅该实习生可见"
                        >
                          👤 个人
                        </button>
                        <button
                          onClick={() => setPublishScope('department')}
                          className={`px-2 py-1.5 text-[0.65rem] font-medium transition-colors ${
                            publishScope === 'department'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-slate-800/40 text-slate-500 hover:text-slate-400'
                          }`}
                          title="同部门所有实习生可见"
                        >
                          🏢 部门
                        </button>
                      </div>
                      <input
                        type="date"
                        value={publishDueDate}
                        onChange={e => setPublishDueDate(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-[0.75rem] text-white focus:border-indigo-500 focus:outline-none"
                        placeholder="截止日期（可选）"
                      />
                      <button
                        onClick={handlePublishTasks}
                        disabled={publishing || publishSelections.size === 0}
                        className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 ${
                          publishScope === 'department' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-500 hover:bg-indigo-600'
                        }`}
                      >
                        {publishing ? (
                          <>
                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            发布中...
                          </>
                        ) : (
                          <>✅ 发布选中 ({publishSelections.size}) · {publishScope === 'department' ? '部门共享' : '个人'}</>
                        )}
                      </button>
                      <button
                        onClick={() => { setPublishMode(false); setPublishSelections(new Set()); setPublishScope('personal') }}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-[0.75rem] text-slate-400 hover:bg-slate-800 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPublishMode(true)}
                      className="rounded-lg bg-indigo-500/15 text-indigo-300 px-3 py-1.5 text-[0.75rem] font-medium hover:bg-indigo-500/25 transition-colors inline-flex items-center gap-1.5"
                      title="从技能树选择技能发布为实习生任务"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                      </svg>
                      发布为任务
                    </button>
                  )}
                </div>
              </div>

              <Card>
                {(() => {
                  const activeGroup = data.grouped?.find(g => g.category === activeCategory)
                  const activeNodes = activeGroup?.nodes || []
                  if (activeNodes.length === 0) {
                    return <EmptyState icon="📋" title={`暂无${CATEGORY_META[activeCategory].label}技能`} />
                  }
                  return (
                    <div className="space-y-0.5">
                      {activeNodes.map(n => renderNode(n, 0))}
                    </div>
                  )
                })()}
              </Card>

              {/* 反馈列表 */}
              {(data.feedbacks || []).length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-white mb-4">📝 反馈记录</h3>
                  <div className="space-y-3">
                    {data.feedbacks!.map(fb => (
                      <div key={fb.id} className="rounded-xl border border-slate-700/30 bg-slate-800/20 p-3.5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[0.75rem] font-medium text-indigo-300">{fb.skill_name}</span>
                            {fb.rating > 0 && (
                              <span className="flex gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <span key={i} className={`text-[0.625rem] ${i < fb.rating ? 'text-amber-400' : 'text-slate-600'}`}>★</span>
                                ))}
                              </span>
                            )}
                          </div>
                          <span className="text-[0.625rem] text-slate-600">
                            {new Date(fb.created_at).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <p className="text-[0.8125rem] text-slate-300 leading-relaxed">{fb.content}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            /* ── 自定义任务列表 ── */
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">📋 自定义任务</h3>
                  <p className="text-[0.75rem] text-slate-500 mt-0.5">导师可为实习生单独分配个性化学习任务</p>
                </div>
                <button onClick={openCreateTask}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                  </svg>
                  新建任务
                </button>
              </div>

              {/* 进度概览 */}
              {customTasks.length > 0 && (() => {
                const mastered = customTasks.filter(t => t.status === 'mastered').length
                const inProgress = customTasks.filter(t => t.status === 'in_progress').length
                const locked = customTasks.filter(t => t.status === 'locked').length
                const total = customTasks.length
                const pct = Math.round((mastered / total) * 100)
                return (
                  <div className="mb-4 grid grid-cols-4 gap-3">
                    <StatBadge label="总计" value={total} color="slate" />
                    <StatBadge label="已掌握" value={mastered} color="emerald" />
                    <StatBadge label="进行中" value={inProgress} color="indigo" />
                    <StatBadge label="未开始" value={locked} color="amber" />
                    <div className="col-span-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[0.75rem] font-medium text-slate-400">{pct}%</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {customTasks.length === 0 ? (
                <EmptyState icon="📭" title="暂无自定义任务" description="点击「新建任务」为实习生分配个性化学习任务" />
              ) : (
                <div className="space-y-2">
                  {customTasks.map(task => {
                    const meta = CATEGORY_META[task.category] || CATEGORY_META.department
                    return (
                      <div key={task.id}
                        className="group rounded-xl border border-slate-700/30 bg-slate-800/20 p-3.5 hover:border-slate-600/50 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[0.8125rem] font-medium text-white truncate">{task.title}</span>
                              <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-medium ${
                                task.status === 'mastered'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : task.status === 'in_progress'
                                  ? 'bg-indigo-500/15 text-indigo-400'
                                  : 'bg-amber-500/15 text-amber-400'
                              }`}>
                                {task.status === 'mastered' ? '已掌握' : task.status === 'in_progress' ? '进行中' : '未开始'}
                              </span>
                              <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-medium bg-${meta.color}-500/15 text-${meta.color}-400`}>
                                {meta.icon} {meta.label}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-[0.75rem] text-slate-400 leading-relaxed mb-1.5">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-[0.65rem] text-slate-600">
                              {task.due_date && (
                                <span>📅 截止：{task.due_date}</span>
                              )}
                              <span>创建：{new Date(task.created_at).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </div>

                          {/* 操作按钮组 */}
                          <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            {/* 快速状态切换 */}
                            <button
                              onClick={() => handleTaskStatus(task.id, task.status === 'locked' ? 'in_progress' : task.status === 'in_progress' ? 'mastered' : 'locked')}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                              title={task.status === 'locked' ? '标记为进行中' : task.status === 'in_progress' ? '标记为已掌握' : '标记为未开始'}
                            >
                              {task.status === 'locked' ? '▶' : task.status === 'in_progress' ? '✓' : '↩'}
                            </button>
                            <button
                              onClick={() => openEditTask(task)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-indigo-400 transition-colors"
                              title="编辑"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                              title="删除"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      ) : (
        <EmptyState icon="📭" title="该实习生未分配部门" description="请先在个人信息中为其分配部门" />
      )}

      {/* ── 反馈模态框 ── */}
      {feedbackSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setFeedbackSkill(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/50 shadow-2xl animate-scale-in p-5">
            <h3 className="text-sm font-semibold text-white mb-4">
              反馈：{feedbackSkill.name}
            </h3>
            <div className="mb-3">
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-2">评分</label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFeedbackRating(i + 1)}
                    className={`text-2xl transition-all duration-150 ${
                      i < feedbackRating
                        ? 'text-amber-400 scale-110'
                        : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-2">反馈内容 *</label>
              <textarea
                value={feedbackContent}
                onChange={e => setFeedbackContent(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                rows={4}
                placeholder="输入对该技能的反馈、建议或评价..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setFeedbackSkill(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
                取消
              </button>
              <button onClick={submitFeedback} disabled={submittingFeedback}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {submittingFeedback ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    提交中...
                  </>
                ) : '提交反馈'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 自定义任务模态框 ── */}
      {showTaskModal && (
        <Modal title={editingTask ? '编辑自定义任务' : '新建自定义任务'} onClose={() => setShowTaskModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">任务标题 *</label>
              <input
                value={taskForm.title}
                onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                placeholder="例如：完成用户画像分析报告"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">任务描述</label>
              <textarea
                value={taskForm.description}
                onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                rows={3}
                placeholder="描述任务的具体要求..."
              />
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">技能层级</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'basic', label: '🌱 基础素养' },
                  { key: 'department', label: '🔧 部门专精' },
                  { key: 'advanced', label: '🚀 进阶业务' },
                ] as const).map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setTaskForm(p => ({ ...p, category: cat.key }))}
                    className={`rounded-lg border px-3 py-2 text-left transition-all duration-200 text-[0.75rem] font-medium ${
                      taskForm.category === cat.key
                        ? cat.key === 'basic'
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : cat.key === 'department'
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                          : 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                        : 'border-slate-700 bg-slate-800/40 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">截止日期（可选）</label>
              <input
                type="date"
                value={taskForm.due_date}
                onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">排序索引</label>
              <input
                type="number"
                value={taskForm.order_index}
                onChange={e => setTaskForm(p => ({ ...p, order_index: parseInt(e.target.value) || 0 }))}
                className="w-24 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setShowTaskModal(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">
                取消
              </button>
              <button
                onClick={handleTaskSubmit}
                disabled={savingTask}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {savingTask ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    保存中...
                  </>
                ) : editingTask ? '保存修改' : '创建任务'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ── 辅助组件 ─────────────────────── */
function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[0.8125rem] font-medium transition-all duration-200 border-b-2 ${
        active
          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 -mb-px'
          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 border-transparent'
      }`}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border border-${color}-500/20 bg-${color}-500/8 p-2.5 text-center`}>
      <div className={`text-lg font-bold text-${color}-400`}>{value}</div>
      <div className="text-[0.625rem] text-slate-500">{label}</div>
    </div>
  )
}
