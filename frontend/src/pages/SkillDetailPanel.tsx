import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useToast } from '../components/ui/Toast'
import type { SkillTreeNode, UserSkillTask } from '../types'

/* ── 状态元数据 ────────────────────── */
const STATUS_META = {
  locked:      { label: '未解锁', color: 'slate',   bg: 'bg-slate-700/60', text: 'text-slate-400' },
  in_progress: { label: '学习中', color: 'amber',   bg: 'bg-amber-500/15', text: 'text-amber-400' },
  mastered:    { label: '已精通', color: 'emerald', bg: 'bg-emerald-500/15',text: 'text-emerald-400' },
} as const

const TASK_STATUS_META = {
  pending:     { label: '待开始', color: 'slate',   bg: 'bg-slate-700/50', text: 'text-slate-400', dot: 'bg-slate-500' },
  in_progress: { label: '进行中', color: 'amber',   bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-400' },
  completed:   { label: '已完成', color: 'emerald', bg: 'bg-emerald-500/15',text: 'text-emerald-400',dot: 'bg-emerald-400' },
} as const

interface Props {
  node: SkillTreeNode | null
  onClose: () => void
  onStatusChange: (skillId: string, newStatus: 'locked' | 'in_progress' | 'mastered') => void
  canManage?: boolean
  onEditNode?: (node: SkillTreeNode) => void
  onDeleteNode?: (nodeId: string, name: string) => void
  onAddChild?: (parentId: string) => void
  onPublishNode?: (nodeId: string, department: string) => void
}

export default function SkillDetailPanel({ node, onClose, onStatusChange, canManage, onEditNode, onDeleteNode, onAddChild, onPublishNode }: Props) {
  const { addToast } = useToast()
  const [tasks, setTasks] = useState<UserSkillTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // 新建任务表单
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [creating, setCreating] = useState(false)

  // 编辑任务
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  /* ── 加载任务 ── */
  const fetchTasks = useCallback(async () => {
    if (!node) return
    setTasksLoading(true)
    try {
      const res = await api.get(`/user-skill-tasks/${node.id}`)
      setTasks(res.data as UserSkillTask[])
    } catch { /* ignore */ }
    finally { setTasksLoading(false) }
  }, [node])

  useEffect(() => {
    if (node) {
      fetchTasks()
      setShowCreateTask(false)
      setEditingTaskId(null)
    }
  }, [node, fetchTasks])

  /* ── 更新技能状态 ── */
  const handleStatusChange = async (newStatus: 'locked' | 'in_progress' | 'mastered') => {
    if (!node) return
    setStatusUpdating(true)
    try {
      await api.post('/skills/me', { skillId: node.id, status: newStatus })
      onStatusChange(node.id, newStatus)
      addToast('success', `技能状态已更新为「${STATUS_META[newStatus].label}」`)
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '状态更新失败')
    } finally { setStatusUpdating(false) }
  }

  /* ── 创建任务 ── */
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) { addToast('warning', '请输入任务标题'); return }
    setCreating(true)
    try {
      await api.post('/user-skill-tasks', {
        skillId: node!.id,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        due_date: newTaskDue || null,
      })
      addToast('success', '任务已创建')
      setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskDue(''); setShowCreateTask(false)
      fetchTasks()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '创建失败')
    } finally { setCreating(false) }
  }

  /* ── 更新任务状态 ── */
  const handleTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.put(`/user-skill-tasks/${taskId}`, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as UserSkillTask['status'] } : t))
      addToast('success', newStatus === 'completed' ? '任务已完成！' : '任务状态已更新')
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '更新失败')
    }
  }

  /* ── 删除任务 ── */
  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`确定删除任务「${title}」吗？`)) return
    try {
      await api.delete(`/user-skill-tasks/${taskId}`)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      addToast('success', '任务已删除')
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '删除失败')
    }
  }

  /* ── 保存编辑 ── */
  const handleSaveEdit = async (taskId: string) => {
    setSavingEdit(true)
    try {
      await api.put(`/user-skill-tasks/${taskId}`, {
        title: editTitle.trim(),
        description: editDesc.trim(),
      })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: editTitle.trim(), description: editDesc.trim() } : t))
      setEditingTaskId(null)
      addToast('success', '任务已更新')
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '更新失败')
    } finally { setSavingEdit(false) }
  }

  const startEdit = (task: UserSkillTask) => {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditDesc(task.description || '')
  }

  const taskStats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
  }

  if (!node) return null

  const meta = STATUS_META[node.status]
  const isLeaf = !node.children || node.children.length === 0

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md flex animate-slide-in-right">
      {/* 背景蒙层 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm md:hidden" onClick={onClose} />

      {/* 面板 */}
      <div className="relative ml-auto w-full max-w-md bg-slate-900 border-l border-slate-800/60 h-full overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/50 px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white truncate">{node.name}</h3>
              <p className="text-[0.7rem] text-slate-500 mt-0.5">
                {node.department || '—'}部 · {node.category === 'basic' ? '🌱 基础' : node.category === 'advanced' ? '🚀 进阶' : '🔧 专精'}
                {!isLeaf && <span className="ml-2 text-slate-600">· 分类节点</span>}
              </p>
            </div>
            <button onClick={onClose} className="shrink-0 ml-3 p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 状态切换按钮组 */}
          <div className="mt-4 flex gap-2">
            {(['locked', 'in_progress', 'mastered'] as const).map(s => {
              const sm = STATUS_META[s]
              const active = node.status === s
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={statusUpdating || active}
                  className={`flex-1 py-2 rounded-xl text-[0.7rem] font-medium transition-all duration-200 border
                    ${active
                      ? `${sm.bg} ${sm.text} border-current/30 cursor-default`
                      : 'bg-slate-800/40 text-slate-500 border-slate-700/30 hover:border-slate-600 hover:text-slate-300'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {sm.label}
                </button>
              )
            })}
          </div>

          {/* 导师/HR 管理操作 */}
          {canManage && (
            <div className="mt-3 flex gap-1.5 flex-wrap">
              {onEditNode && (
                <button onClick={() => onEditNode(node)}
                  className="flex-1 min-w-[60px] py-1.5 rounded-lg text-[0.65rem] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 transition-colors inline-flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  编辑
                </button>
              )}
              {onAddChild && (
                <button onClick={() => onAddChild(node.id)}
                  className="flex-1 min-w-[60px] py-1.5 rounded-lg text-[0.65rem] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition-colors inline-flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                  </svg>
                  添加子节点
                </button>
              )}
              {isLeaf && onPublishNode && (
                <button onClick={() => onPublishNode(node.id, node.department || '')}
                  className="flex-1 min-w-[60px] py-1.5 rounded-lg text-[0.65rem] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 transition-colors inline-flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  发布任务
                </button>
              )}
              {onDeleteNode && (
                <button onClick={() => onDeleteNode(node.id, node.name)}
                  className="flex-1 min-w-[60px] py-1.5 rounded-lg text-[0.65rem] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors inline-flex items-center justify-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  删除
                </button>
              )}
            </div>
          )}

          {/* 进度条 */}
          <div className="mt-3">
            <div className="flex justify-between text-[0.65rem] text-slate-500 mb-1.5">
              <span>学习进度</span>
              <span className="font-mono">
                {node.status === 'mastered' ? '100%' : node.status === 'in_progress' ? '50%' : '0%'}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  node.status === 'mastered' ? 'bg-emerald-500' : node.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-700'
                }`}
                style={{ width: node.status === 'mastered' ? '100%' : node.status === 'in_progress' ? '50%' : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* 技能描述 */}
          {node.description && (
            <div>
              <h4 className="text-[0.7rem] font-semibold text-slate-400 uppercase tracking-wider mb-2">技能描述</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{node.description}</p>
            </div>
          )}

          {/* 学习资料 */}
          {node.resources_parsed && node.resources_parsed.length > 0 && (
            <div>
              <h4 className="text-[0.7rem] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                学习资料 ({node.resources_parsed.length})
              </h4>
              <div className="space-y-2">
                {node.resources_parsed.map((res, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 px-3 py-2.5 hover:border-slate-600/50 transition-colors">
                    <span className="shrink-0 w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center text-[0.65rem] text-indigo-400 font-bold">
                      {i + 1}
                    </span>
                    <span className="text-[0.8rem] text-slate-300 truncate">{res}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 叶子节点：自定义任务区 */}
          {isLeaf && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[0.7rem] font-semibold text-slate-400 uppercase tracking-wider">
                  我的任务 ({tasks.length})
                </h4>
                <button
                  onClick={() => setShowCreateTask(!showCreateTask)}
                  className="text-[0.65rem] font-medium text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                  </svg>
                  添加任务
                </button>
              </div>

              {/* 任务统计 */}
              {tasks.length > 0 && (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <div className="rounded-lg bg-slate-800/40 p-2 text-center">
                    <p className="text-[0.65rem] font-bold text-slate-300">{taskStats.total}</p>
                    <p className="text-[0.55rem] text-slate-500">总计</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                    <p className="text-[0.65rem] font-bold text-amber-400">{taskStats.inProgress}</p>
                    <p className="text-[0.55rem] text-amber-400/70">进行中</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                    <p className="text-[0.65rem] font-bold text-emerald-400">{taskStats.completed}</p>
                    <p className="text-[0.55rem] text-emerald-400/70">已完成</p>
                  </div>
                </div>
              )}

              {/* 新建任务表单 */}
              {showCreateTask && (
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3.5 mb-3 space-y-3 animate-fade-slide-up">
                  <input
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    placeholder="任务标题 *"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[0.8rem] text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <input
                    value={newTaskDesc}
                    onChange={e => setNewTaskDesc(e.target.value)}
                    placeholder="任务描述（可选）"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[0.8rem] text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={e => setNewTaskDue(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[0.8rem] text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowCreateTask(false)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-[0.7rem] text-slate-400 hover:bg-slate-800 transition-colors">
                      取消
                    </button>
                    <button onClick={handleCreateTask} disabled={creating || !newTaskTitle.trim()}
                      className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[0.7rem] font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5">
                      {creating ? (
                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : null}
                      创建任务
                    </button>
                  </div>
                </div>
              )}

              {/* 任务列表 */}
              {tasksLoading ? (
                <div className="space-y-2">
                  {[1,2].map(i => (
                    <div key={i} className="animate-pulse rounded-lg bg-slate-800/30 h-16" />
                  ))}
                </div>
              ) : tasks.length > 0 ? (
                <div className="space-y-2">
                  {tasks.map(task => {
                    const tm = TASK_STATUS_META[task.status]
                    const isEditing = editingTaskId === task.id
                    return isEditing ? (
                      <div key={task.id} className="rounded-xl bg-slate-800/60 border border-indigo-500/30 p-3 space-y-2.5 animate-fade-slide-up">
                        <input
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-[0.8rem] text-white focus:border-indigo-500 focus:outline-none"
                          autoFocus
                        />
                        <textarea
                          value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-[0.8rem] text-white focus:border-indigo-500 focus:outline-none resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingTaskId(null)}
                            className="rounded-lg border border-slate-700 px-3 py-1 text-[0.65rem] text-slate-400 hover:bg-slate-800 transition-colors">
                            取消
                          </button>
                          <button onClick={() => handleSaveEdit(task.id)} disabled={savingEdit}
                            className="rounded-lg bg-indigo-500 px-3 py-1 text-[0.65rem] font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50">
                            {savingEdit ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={task.id}
                        className={`rounded-lg border transition-all duration-200 px-3 py-2.5
                          ${task.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/15 opacity-80' : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'}
                        `}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={`text-[0.8rem] font-medium truncate ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-[0.65rem] text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`inline-flex items-center gap-1 text-[0.6rem] font-medium ${tm.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${tm.dot}`} />
                                {tm.label}
                              </span>
                              {task.due_date && (
                                <span className="text-[0.6rem] text-slate-600">📅 {task.due_date}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* 状态切换 */}
                            <select
                              value={task.status}
                              onChange={e => handleTaskStatus(task.id, e.target.value)}
                              className="rounded-md border border-slate-700 bg-slate-800/60 text-[0.6rem] text-slate-400 px-1.5 py-1 focus:outline-none cursor-pointer appearance-none"
                            >
                              <option value="pending">待开始</option>
                              <option value="in_progress">进行中</option>
                              <option value="completed">已完成</option>
                            </select>
                            <button onClick={() => startEdit(task)}
                              className="p-1 rounded text-slate-600 hover:text-slate-400 transition-colors" title="编辑">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDeleteTask(task.id, task.title)}
                              className="p-1 rounded text-slate-600 hover:text-rose-400 transition-colors" title="删除">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-[0.75rem] text-slate-600">
                  暂无自定义任务，点击「添加任务」创建
                </div>
              )}
            </div>
          )}

          {/* 分类节点提示 */}
          {!isLeaf && (
            <div className="text-center py-8 text-slate-600">
              <p className="text-3xl mb-2">📂</p>
              <p className="text-[0.8rem]">这是分类节点</p>
              <p className="text-[0.65rem] mt-1">点击子节点可添加自定义任务</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
