import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Card, EmptyState, SkeletonCard, PageHeader, Badge } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'
import SkillTreeView from './SkillTreeView'
import SkillDetailPanel from './SkillDetailPanel'
import type {
  SkillFlatNode, SkillTreeNode, SkillTreeResponse,
  MentorTask, MentorIntern, DepartmentTask, BatchDeptTaskResult,
} from '../types'

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

const CATEGORY_META = {
  basic:       { label: '基础素养', icon: '🌱', color: 'emerald' },
  department:  { label: '部门专精', icon: '🔧', color: 'indigo' },
  advanced:    { label: '进阶业务', icon: '🚀', color: 'violet' },
} as const

/** 递归查找树中的节点 */
function findNodeInTree(nodes: SkillTreeNode[], id: string): SkillTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findNodeInTree(n.children, id)
      if (found) return found
    }
  }
  return null
}

/* ── 主组件 ─────────────────────────── */
export default function SkillManage() {
  const { user } = useAuth()
  const { addToast } = useToast()

  // 标签页
  const [activeTab, setActiveTab] = useState<'tree' | 'manage' | 'deptTasks'>('tree')

  // ── 技能树（可视化）──
  const [treeData, setTreeData] = useState<SkillTreeResponse | null>(null)
  const [treeLoading, setTreeLoading] = useState(true)
  const [treeDept, setTreeDept] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [selectedNode, setSelectedNode] = useState<SkillTreeNode | null>(null)

  // ── 技能管理（CRUD 列表）──
  const [skills, setSkills] = useState<SkillFlatNode[]>([])
  const [manageDept, setManageDept] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingNode, setEditingNode] = useState<SkillFlatNode | null>(null)
  const [form, setForm] = useState({
    name: '', department: '', parent_id: '', parent_name: '',
    category: 'department' as 'basic'|'department'|'advanced',
    description: '', resources: [] as string[], order_index: 0,
  })
  const [newResource, setNewResource] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [parentNameError, setParentNameError] = useState('')

  // ── 自定义任务（导师端）──
  const [mentorTasks, setMentorTasks] = useState<MentorTask[]>([])
  const [allInterns, setAllInterns] = useState<MentorIntern[]>([])
  const [tasksFilterDept, setTasksFilterDept] = useState('')
  const [tasksLoading, setTasksLoading] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<MentorTask | null>(null)
  const [taskForm, setTaskForm] = useState({
    internId: '', title: '', description: '',
    category: 'department' as 'basic'|'department'|'advanced',
    due_date: '', order_index: 0,
  })
  const [savingTask, setSavingTask] = useState(false)

  // ── 批量发布 ──
  const [batchMode, setBatchMode] = useState(false)
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set())
  const [batchDueDate, setBatchDueDate] = useState('')
  const [batchPublishing, setBatchPublishing] = useState(false)
  const [publishNode, setPublishNode] = useState<SkillFlatNode | null>(null)
  const [publishDueDate, setPublishDueDate] = useState('')
  const [publishing, setPublishing] = useState(false)

  // ── 部门任务 ──
  const [deptTasks, setDeptTasks] = useState<DepartmentTask[]>([])
  const [deptTasksLoading, setDeptTasksLoading] = useState(false)
  const [deptTaskDept, setDeptTaskDept] = useState('')
  const [deptTaskDepartments, setDeptTaskDepartments] = useState<string[]>([])

  const canManage = user?.role === 'mentor' || user?.role === 'hr'

  // ── 加载部门列表 ──
  useEffect(() => {
    api.get('/skills/departments').then(res => {
      const depts = res.data as string[]
      setDepartments(depts)
      if (depts.length > 0) {
        const defaultDept = user?.department && depts.includes(user.department) ? user.department : depts[0]
        setTreeDept(defaultDept)
        setManageDept(defaultDept)
      }
    }).catch(() => {})
  }, [user])

  // ── 加载技能树（可视化用）──
  const fetchTree = useCallback(async () => {
    if (!treeDept) return
    setTreeLoading(true)
    try {
      const res = await api.get(`/skills/tree?department=${encodeURIComponent(treeDept)}`)
      setTreeData(res.data as SkillTreeResponse)
    } catch { setTreeData(null) }
    finally { setTreeLoading(false) }
  }, [treeDept])

  useEffect(() => { fetchTree() }, [fetchTree])

  // ── 加载技能列表（管理用）──
  const fetchSkills = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await api.get('/skills')
      setSkills(res.data as SkillFlatNode[])
    } catch { setError('技能列表加载失败') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSkills() }, [fetchSkills])

  // ── 部门任务 ──
  const fetchDeptTasks = useCallback(async () => {
    setDeptTasksLoading(true)
    try {
      const [tasksRes, deptsRes] = await Promise.all([
        api.get('/department-tasks'),
        api.get('/department-tasks/departments'),
      ])
      setDeptTasks(tasksRes.data as DepartmentTask[])
      setDeptTaskDepartments(deptsRes.data as string[])
    } catch { /* ignore */ }
    finally { setDeptTasksLoading(false) }
  }, [])

  useEffect(() => {
    if (activeTab === 'deptTasks') fetchDeptTasks()
  }, [activeTab, fetchDeptTasks])

  // ── 自定义任务（导师端）──
  const fetchMentorTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const internsRes = await api.get('/skills/mentor/interns')
      setAllInterns(internsRes.data as MentorIntern[])
      const allTasks: MentorTask[] = []
      for (const intern of internsRes.data as MentorIntern[]) {
        try {
          const tasksRes = await api.get(`/mentor-tasks/${intern.id}`)
          allTasks.push(...(tasksRes.data as MentorTask[]))
        } catch { /* skip */ }
      }
      setMentorTasks(allTasks)
    } catch { /* ignore */ }
    finally { setTasksLoading(false) }
  }, [])

  // ── 技能树节点状态变更回调 ──
  const handleNodeStatusChange = useCallback((skillId: string, newStatus: string) => {
    setTreeData(prev => {
      if (!prev) return prev
      const updateNode = (nodes: SkillTreeNode[]): SkillTreeNode[] =>
        nodes.map(n => ({
          ...n,
          status: n.id === skillId ? (newStatus as SkillTreeNode['status']) : n.status,
          children: n.children ? updateNode(n.children) : n.children,
        }))
      return {
        ...prev,
        tree: updateNode(prev.tree),
        grouped: prev.grouped?.map(g => ({
          ...g,
          nodes: updateNode(g.nodes),
        })),
      }
    })
    setSelectedNode(prev => prev && prev.id === skillId ? { ...prev, status: newStatus as SkillTreeNode['status'] } : prev)
  }, [])

  // ── 技能管理 CRUD ──
  const openCreate = () => {
    setEditingNode(null)
    setForm({ name: '', department: manageDept, parent_id: '', parent_name: '', category: 'department', description: '', resources: [], order_index: 0 })
    setNewResource('')
    setParentNameError('')
    setShowModal(true)
  }

  const openEdit = (node: SkillFlatNode) => {
    setEditingNode(node)
    // 编辑时，从已有 skills 列表中查找父节点名称
    const parentNode = node.parent_id ? skills.find(s => s.id === node.parent_id) : null
    setForm({
      name: node.name, department: node.department || '', parent_id: node.parent_id || '',
      parent_name: parentNode?.name || '',
      category: node.category || 'department', description: node.description || '',
      resources: [...node.resources_parsed], order_index: node.order_index || 0,
    })
    setNewResource('')
    setParentNameError('')
    setShowModal(true)
  }

  const addResource = () => {
    const trimmed = newResource.trim()
    if (!trimmed) return
    if (form.resources.includes(trimmed)) { addToast('warning', '该资料已存在'); return }
    setForm(prev => ({ ...prev, resources: [...prev.resources, trimmed] }))
    setNewResource('')
  }

  const removeResource = (idx: number) => {
    setForm(prev => ({ ...prev, resources: prev.resources.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { addToast('error', '请输入技能名称'); return }
    if (!form.department.trim()) { addToast('error', '请选择部门'); return }

    // 父节点名称校验
    const pn = form.parent_name?.trim()
    if (pn && pn.length > 128) { addToast('error', '父节点名称不能超过128个字符'); return }
    if (pn && pn === form.name.trim()) { addToast('error', '父节点不能与当前节点同名'); return }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        department: form.department.trim(),
        parent_id: form.parent_id || undefined,
        parent_name: pn || undefined,
        category: form.category,
        description: form.description,
        resources: form.resources,
        order_index: form.order_index,
      }
      if (editingNode) {
        await api.put(`/skills/${editingNode.id}`, payload)
        addToast('success', '技能节点已更新')
      } else {
        await api.post('/skills', payload)
        addToast('success', '技能节点已创建')
      }
      setShowModal(false)
      fetchSkills()
      fetchTree() // 同步更新技能树可视化
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '操作失败')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除「${name}」吗？子节点将移到根层级，操作不可撤销。`)) return
    setDeletingId(id)
    try {
      await api.delete(`/skills/${id}`)
      addToast('success', `已删除「${name}」`)
      fetchSkills()
      fetchTree() // 同步更新技能树可视化
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '删除失败')
    } finally { setDeletingId(null) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  /* ── 内联重命名（树视图双击/右键触发）── */
  const handleRename = useCallback(async (nodeId: string, newName: string): Promise<boolean> => {
    try {
      await api.put(`/skills/${nodeId}`, { name: newName.trim() })
      addToast('success', '节点已重命名')
      // 乐观更新技能树
      setTreeData(prev => {
        if (!prev) return prev
        const updateName = (nodes: SkillTreeNode[]): SkillTreeNode[] =>
          nodes.map(n => ({
            ...n,
            name: n.id === nodeId ? newName.trim() : n.name,
            children: n.children ? updateName(n.children) : n.children,
          }))
        return { ...prev, tree: updateName(prev.tree), grouped: prev.grouped?.map(g => ({ ...g, nodes: updateName(g.nodes) })) }
      })
      setSelectedNode(prev => prev && prev.id === nodeId ? { ...prev, name: newName.trim() } : prev)
      // 同步刷新管理列表
      fetchSkills()
      return true
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '重命名失败')
      return false
    }
  }, [addToast, fetchSkills])


  // ── 批量发布 ──
  const handleBatchPublish = async () => {
    const skillIds = [...batchSelectedIds]
    if (skillIds.length === 0) { addToast('warning', '请先勾选要发布的技能节点'); return }
    setBatchPublishing(true)
    try {
      const res = await api.post<BatchDeptTaskResult>('/department-tasks/batch-from-skills', {
        department: manageDept, skillIds, due_date: batchDueDate || null,
      })
      addToast('success', res.data.message || `成功发布 ${res.data.created} 个部门任务`)
      setBatchSelectedIds(new Set()); setBatchMode(false); setBatchDueDate('')
      setActiveTab('deptTasks'); fetchDeptTasks()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '批量发布失败')
    } finally { setBatchPublishing(false) }
  }

  const handleQuickPublish = async () => {
    if (!publishNode) return
    if (publishNode.child_count > 0) { addToast('warning', '分类节点无法发布'); setPublishing(false); return }
    setPublishing(true)
    try {
      const res = await api.post<BatchDeptTaskResult>('/department-tasks/batch-from-skills', {
        department: publishNode.department || manageDept,
        skillIds: [publishNode.id],
        due_date: publishDueDate || null,
      })
      addToast('success', res.data.message || '部门任务已发布')
      setPublishNode(null)
      setActiveTab('deptTasks'); fetchDeptTasks()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '发布失败')
    } finally { setPublishing(false) }
  }

  // ── 部门任务操作 ──
  const handleDeptTaskStatus = async (taskId: string, newStatus: 'active'|'archived') => {
    try {
      await api.put(`/department-tasks/${taskId}`, { status: newStatus })
      setDeptTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      addToast('success', newStatus === 'archived' ? '已归档' : '已恢复')
    } catch (err: any) { addToast('error', err?.response?.data?.error || '操作失败') }
  }

  const handleDeleteDeptTask = async (taskId: string, title: string) => {
    if (!confirm(`确定删除部门任务「${title}」吗？`)) return
    try {
      await api.delete(`/department-tasks/${taskId}`)
      setDeptTasks(prev => prev.filter(t => t.id !== taskId))
      addToast('success', '已删除')
    } catch (err: any) { addToast('error', err?.response?.data?.error || '删除失败') }
  }

  // ── 自定义任务 CRUD ──
  const openCreateTask = () => {
    setEditingTask(null)
    setTaskForm({ internId: '', title: '', description: '', category: 'department', due_date: '', order_index: 0 })
    setShowTaskModal(true)
  }

  const openEditTask = (task: MentorTask) => {
    setEditingTask(task)
    setTaskForm({
      internId: task.intern_id, title: task.title, description: task.description || '',
      category: task.category, due_date: task.due_date || '', order_index: task.order_index,
    })
    setShowTaskModal(true)
  }

  const handleTaskSubmit = async () => {
    if (!taskForm.title.trim()) { addToast('error', '请输入任务标题'); return }
    if (!taskForm.internId) { addToast('error', '请选择实习生'); return }
    setSavingTask(true)
    try {
      if (editingTask) {
        await api.put(`/mentor-tasks/${editingTask.id}`, {
          title: taskForm.title.trim(), description: taskForm.description,
          category: taskForm.category, due_date: taskForm.due_date || null, order_index: taskForm.order_index,
        })
        addToast('success', '任务已更新')
      } else {
        await api.post('/mentor-tasks', {
          internId: taskForm.internId, title: taskForm.title.trim(),
          description: taskForm.description, category: taskForm.category,
          due_date: taskForm.due_date || null, order_index: taskForm.order_index,
        })
        addToast('success', '任务已创建')
      }
      setShowTaskModal(false)
      fetchMentorTasks()
    } catch (err: any) {
      addToast('error', err?.response?.data?.error || '操作失败')
    } finally { setSavingTask(false) }
  }

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`确定删除任务「${title}」吗？`)) return
    try {
      await api.delete(`/mentor-tasks/${taskId}`)
      addToast('success', `已删除「${title}」`)
      fetchMentorTasks()
    } catch (err: any) { addToast('error', err?.response?.data?.error || '删除失败') }
  }

  // ── 过滤 ──
  const deptSkills = skills.filter(s => s.department === manageDept)
  const parentOptions = deptSkills
  // 是否从树视图快捷添加子节点（parent_id 已在 open 时预填）
  const isQuickAddChild = !!form.parent_id && !editingNode
  const getInternName = (id: string) => allInterns.find(i => i.id === id)?.name || '未知'
  const getInternDept = (id: string) => allInterns.find(i => i.id === id)?.department || ''
  const filteredTasks = tasksFilterDept ? mentorTasks.filter(t => getInternDept(t.intern_id) === tasksFilterDept) : mentorTasks
  const taskDepartments = [...new Set(mentorTasks.map(t => getInternDept(t.intern_id)).filter(Boolean))]
  const filteredDeptTasks = deptTaskDept ? deptTasks.filter(t => t.department === deptTaskDept) : deptTasks

  if (!user) return <EmptyState icon="🔒" title="请先登录" />

  return (
    <div className="page-enter pb-8">
      <PageHeader title="技能中心" subtitle={canManage ? '技能树可视化 · 技能管理 · 部门任务' : '我的技能树 · 学习进度追踪'}>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* 部门切换（技能树和管理 Tab 共用） */}
          {activeTab !== 'deptTasks' && departments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {departments.map(d => (
                <button key={d} onClick={() => { setTreeDept(d); setManageDept(d) }}
                  className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-all duration-200 ${
                    (activeTab === 'tree' ? d === treeDept : d === manageDept)
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:bg-slate-800'
                  }`}>
                  {d}部
                </button>
              ))}
            </div>
          )}

          {/* 新建按钮 — 导师/HR在所有标签页都可见 */}
          {canManage && (
            <div className="flex items-center gap-2 ml-auto">
              {activeTab === 'manage' && (
                <button onClick={() => { setBatchMode(!batchMode); setBatchSelectedIds(new Set()) }}
                  className="rounded-lg px-3 py-1.5 text-[0.75rem] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors inline-flex items-center gap-1.5 border border-amber-500/20">
                  📦 批量发布任务
                </button>
              )}
              <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2 text-[0.8rem]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14"/>
                </svg>
                新建技能
              </button>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Tab 切换 */}
      <div className="flex gap-1 border-b border-slate-800/50 mb-6">
        <button onClick={() => setActiveTab('tree')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[0.8125rem] font-medium transition-all duration-200 border-b-2 ${
            activeTab === 'tree' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 -mb-px' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 border-transparent'
          }`}>
          <span>🌳</span><span>技能树</span>
        </button>

        {canManage && (
          <>
            <button onClick={() => setActiveTab('manage')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[0.8125rem] font-medium transition-all duration-200 border-b-2 ${
                activeTab === 'manage' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 -mb-px' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 border-transparent'
              }`}>
              <span>⚙️</span><span>技能管理</span>
            </button>
            <button onClick={() => { setActiveTab('deptTasks'); fetchDeptTasks() }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[0.8125rem] font-medium transition-all duration-200 border-b-2 ${
                activeTab === 'deptTasks' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 -mb-px' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 border-transparent'
              }`}>
              <span>🏢</span><span>部门任务 ({deptTasks.length})</span>
            </button>
          </>
        )}

        {!canManage && (
          <button onClick={() => { setActiveTab('deptTasks'); fetchDeptTasks() }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[0.8125rem] font-medium transition-all duration-200 border-b-2 ${
              activeTab === 'deptTasks' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 -mb-px' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20 border-transparent'
            }`}>
            <span>🏢</span><span>部门任务</span>
          </button>
        )}
      </div>

      {/* ── 技能树 Tab（可视化）── */}
      {activeTab === 'tree' && (
        <div className="relative">
          {treeLoading ? (
            <div className="p-6"><SkeletonCard lines={8} /></div>
          ) : treeData ? (
            <SkillTreeView
              grouped={treeData.grouped}
              tree={treeData.tree}
              department={treeData.department}
              onSelectNode={setSelectedNode}
              selectedNodeId={selectedNode?.id || null}
              canManage={canManage}
              onRename={handleRename}
              onAddChild={(parentId) => {
                // 从树视图点击"+"添加子节点，预填父节点和部门
                const parent = findNodeInTree(treeData?.tree || [], parentId)
                setEditingNode(null)
                setForm({ 
                  name: '', department: parent?.department || treeDept, 
                  parent_id: parentId, parent_name: parent?.name || '',
                  category: parent?.category || 'department', 
                  description: '', resources: [], order_index: 0 
                })
                setNewResource('')
                setParentNameError('')
                setSelectedNode(null)
                setShowModal(true)
              }}
              onAddRoot={() => {
                // 新建根节点
                setEditingNode(null)
                setForm({ name: '', department: treeDept, parent_id: '', parent_name: '', category: 'department', description: '', resources: [], order_index: 0 })
                setNewResource('')
                setParentNameError('')
                setSelectedNode(null)
                setShowModal(true)
              }}
            />
          ) : (
            <EmptyState icon="🌳" title="暂无技能树数据" description={`${treeDept}部门暂未建立技能树`} />
          )}
        </div>
      )}

      {/* ── 技能管理 Tab（CRUD 列表）── */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          {/* 批量发布工具栏 */}
          {canManage && deptSkills.length > 0 && (
            <div className="flex justify-end">
              {batchMode ? (
                <div className="flex items-center gap-2">
                  <span className="text-[0.75rem] text-amber-400 font-medium">已选 {batchSelectedIds.size} 个</span>
                  <button onClick={() => setBatchSelectedIds(new Set(deptSkills.filter(s => s.child_count === 0).map(s => s.id)))}
                    className="rounded-lg px-2 py-1.5 text-[0.7rem] font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors">
                    全选叶子节点
                  </button>
                  <input type="date" value={batchDueDate} onChange={e => setBatchDueDate(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-[0.7rem] text-white focus:border-amber-500 focus:outline-none w-32" />
                  <button onClick={handleBatchPublish} disabled={batchPublishing || batchSelectedIds.size === 0}
                    className="rounded-lg px-3 py-1.5 text-[0.75rem] font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5">
                    {batchPublishing ? '发布中...' : '🏢 批量发布'}
                  </button>
                  <button onClick={() => { setBatchMode(false); setBatchSelectedIds(new Set()) }}
                    className="rounded-lg border border-slate-700 px-2 py-1.5 text-[0.7rem] text-slate-400 hover:bg-slate-800 transition-colors">取消</button>
                </div>
              ) : (
                <button onClick={() => setBatchMode(true)}
                  className="rounded-lg px-3 py-1.5 text-[0.75rem] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors inline-flex items-center gap-1.5 border border-amber-500/20">
                  批量发布任务
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="alert alert-error animate-scale-in" role="alert">
              <p className="font-medium">加载失败</p>
              <p className="mt-0.5 text-rose-300/80 text-[0.8125rem]">{error}</p>
            </div>
          )}

          <Card padding={false}>
            {loading ? (
              <div className="p-6"><SkeletonCard lines={6} /></div>
            ) : deptSkills.length > 0 ? (
              <div className="divide-y divide-slate-800/50">
                <div className={`grid gap-3 px-5 py-3 text-[0.6875rem] font-semibold text-slate-500 uppercase tracking-wider
                  ${batchMode ? 'grid-cols-[36px_1fr_80px_80px_60px_140px]' : 'grid-cols-[1fr_80px_80px_60px_140px]'}`}>
                  {batchMode && <span className="text-center">选</span>}
                  <span>名称 / 描述</span>
                  <span className="text-center">分类</span>
                  <span className="text-center">层级</span>
                  <span className="text-center">资料</span>
                  <span className="text-right">操作</span>
                </div>
                {deptSkills.map(node => {
                  const isLeaf = node.child_count === 0
                  return (
                  <div key={node.id}
                    className={`grid gap-3 px-5 py-3.5 items-center transition hover:bg-slate-800/20
                      ${node.parent_id ? 'pl-10' : ''}
                      ${batchMode ? 'grid-cols-[36px_1fr_80px_80px_60px_140px]' : 'grid-cols-[1fr_80px_80px_60px_140px]'}`}>
                    {batchMode && (
                      <span className="flex justify-center">
                        {isLeaf ? (
                          <input type="checkbox" checked={batchSelectedIds.has(node.id)}
                            onChange={() => setBatchSelectedIds(prev => { const n = new Set(prev); n.has(node.id) ? n.delete(node.id) : n.add(node.id); return n })}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-amber-500 cursor-pointer" />
                        ) : <span className="text-slate-700 text-[0.6rem]">—</span>}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {node.parent_id
                          ? <span className="text-[0.65rem] text-slate-600">└</span>
                          : <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/15 text-[0.6rem] text-indigo-400 font-bold">R</span>
                        }
                        <span className={`text-sm font-medium truncate ${node.parent_id ? 'text-slate-300' : 'text-white'}`}>
                          {node.name}
                        </span>
                        {node.child_count > 0 && <Badge label={`${node.child_count}子`} variant="default" />}
                      </div>
                      {node.description && (
                        <p className="mt-0.5 text-[0.75rem] text-slate-500 truncate ml-7">{node.description}</p>
                      )}
                    </div>
                    <span className="text-center text-[0.6875rem]">
                      <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${
                        node.category === 'basic' ? 'bg-emerald-500/15 text-emerald-400'
                          : node.category === 'advanced' ? 'bg-violet-500/15 text-violet-400'
                          : 'bg-indigo-500/15 text-indigo-400'
                      }`}>
                        {node.category === 'basic' ? '基础' : node.category === 'advanced' ? '进阶' : '专精'}
                      </span>
                    </span>
                    <span className="text-center text-[0.75rem] text-slate-500">
                      {node.parent_id ? '子节点' : '根节点'}
                    </span>
                    <span className="text-center text-[0.75rem] text-slate-500">
                      {node.resources_parsed.length}
                    </span>
                    <div className="flex items-center justify-end gap-1">
                      {!batchMode && isLeaf && (
                        <button onClick={() => { setPublishNode(node); setPublishDueDate('') }}
                          className="rounded-lg px-2 py-1.5 text-[0.7rem] font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors inline-flex items-center gap-1"
                          title="发布为部门任务">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                          发布
                        </button>
                      )}
                      <button onClick={() => openEdit(node)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors" title="编辑">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(node.id, node.name)} disabled={deletingId === node.id}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors" title="删除">
                        {deletingId === node.id ? (
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <EmptyState icon="📋" title="暂无技能节点" description={`${manageDept}部门还没有技能节点，点击上方按钮创建`} />
            )}
          </Card>
        </div>
      )}

      {/* ── 部门任务 Tab ── */}
      {activeTab === 'deptTasks' && (
        <div className="space-y-4">
          {deptTaskDepartments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setDeptTaskDept('')}
                className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-all ${
                  !deptTaskDept ? 'bg-slate-700 text-white' : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:text-slate-300'
                }`}>全部部门</button>
              {deptTaskDepartments.map(d => (
                <button key={d} onClick={() => setDeptTaskDept(d)}
                  className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-all ${
                    d === deptTaskDept ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:bg-slate-800'
                  }`}>{d}部</button>
              ))}
            </div>
          )}

          <Card padding={false}>
            {deptTasksLoading ? (
              <div className="p-6"><SkeletonCard lines={5} /></div>
            ) : filteredDeptTasks.length > 0 ? (
              <div className="divide-y divide-slate-800/50">
                <div className="grid grid-cols-[1fr_100px_80px_80px_120px] gap-3 px-5 py-3 text-[0.6875rem] font-semibold text-slate-500 uppercase tracking-wider">
                  <span>任务 / 部门</span>
                  <span className="text-center">分类</span>
                  <span className="text-center">状态</span>
                  <span className="text-center">截止</span>
                  <span className="text-right">操作</span>
                </div>
                {filteredDeptTasks.map(task => {
                  const meta = CATEGORY_META[task.category] || CATEGORY_META.department
                  return (
                    <div key={task.id} className={`grid grid-cols-[1fr_100px_80px_80px_120px] gap-3 px-5 py-3 items-center transition hover:bg-slate-800/20 ${task.status === 'archived' ? 'opacity-50' : ''}`}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{task.title}</p>
                          {task.skill_source_id && (
                            <span className="shrink-0 text-[0.55rem] px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-400">技能树</span>
                          )}
                        </div>
                        <p className="text-[0.6875rem] text-slate-500 truncate">
                          🏢 {task.department}部{task.creator_name && <span className="ml-2">· {task.creator_name}</span>}
                        </p>
                      </div>
                      <span className="text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-medium bg-${meta.color}-500/15 text-${meta.color}-400`}>
                          {meta.icon} {meta.label}
                        </span>
                      </span>
                      <span className="text-center">
                        <button onClick={() => handleDeptTaskStatus(task.id, task.status === 'active' ? 'archived' : 'active')}
                          className={`inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-medium transition-colors cursor-pointer ${
                            task.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-slate-600/30 text-slate-500 hover:bg-slate-600/50'
                          }`}>
                          {task.status === 'active' ? '生效中' : '已归档'}
                        </button>
                      </span>
                      <span className="text-center text-[0.75rem] text-slate-500">{task.due_date || '无期限'}</span>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleDeleteDeptTask(task.id, task.title)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors" title="删除">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState icon="🏢" title="暂无部门共享任务" description="从技能模板点击发布创建同部门实习生可见的任务" />
            )}
          </Card>
        </div>
      )}

      {/* ── 技能树详情面板 ── */}
      <SkillDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onStatusChange={handleNodeStatusChange}
        canManage={canManage}
        onEditNode={(node) => {
          // 将 SkillTreeNode 转为 SkillFlatNode 用于编辑
          const flat: SkillFlatNode = {
            id: node.id, name: node.name, department: node.department || '',
            parent_id: node.parent_id, category: node.category,
            description: node.description, resources_parsed: node.resources_parsed,
            order_index: node.order_index, child_count: node.children.length,
            created_at: '',
          }
          setSelectedNode(null)
          openEdit(flat)
          setActiveTab('manage')
        }}
        onDeleteNode={(nodeId, name) => {
          setSelectedNode(null)
          handleDelete(nodeId, name)
        }}
        onAddChild={(parentId) => {
          const parent = findNodeInTree(treeData?.tree || [], parentId)
          setEditingNode(null)
          setForm({ 
            name: '', department: parent?.department || manageDept, 
            parent_id: parentId, parent_name: parent?.name || '',
            category: parent?.category || 'department', 
            description: '', resources: [], order_index: 0 
          })
          setNewResource('')
          setParentNameError('')
          setSelectedNode(null)
          setShowModal(true)
        }}
        onPublishNode={(nodeId, department) => {
          const s = skills.find(sk => sk.id === nodeId)
          if (s) {
            setPublishNode(s)
            setPublishDueDate('')
            setSelectedNode(null)
          }
        }}
      />

      {/* ── 技能管理模态框 ── */}
      {showModal && (
        <Modal title={editingNode ? '编辑技能节点' : isQuickAddChild ? `➕ 添加子节点` : '🌳 新建根节点'} onClose={() => setShowModal(false)}>
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            {/* 快捷添加子节点：显示父节点提示 */}
            {isQuickAddChild && form.parent_name && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-2 text-[0.75rem]">
                <span className="text-emerald-400">📁</span>
                <span className="text-slate-300">父节点：</span>
                <span className="text-emerald-400 font-semibold">{form.parent_name}</span>
                <span className="text-slate-600 text-[0.65rem] ml-auto">{form.department}部</span>
              </div>
            )}

            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">技能名称 *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                placeholder={isQuickAddChild ? `「${form.parent_name || '父节点'}」下的技能名称` : "例如：PRD 撰写"} autoFocus />
            </div>

            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">
                所属部门 *
                {isQuickAddChild && <span className="ml-1 text-[0.6rem] text-slate-600">（与父节点一致，自动锁定）</span>}
              </label>
              <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                disabled={isQuickAddChild}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-60 disabled:cursor-not-allowed">
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {!isQuickAddChild && (
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">父节点名称（可选，输入选择或新建）</label>
              <div className="relative">
                <input
                  value={form.parent_name}
                  onChange={e => {
                    setParentNameError('')
                    setForm(p => ({ ...p, parent_name: e.target.value, parent_id: '' }))
                  }}
                  onBlur={() => {
                    // 失焦时智能匹配已有节点
                    const val = form.parent_name.trim()
                    if (val) {
                      const match = parentOptions.find(
                        n => n.name === val && n.id !== editingNode?.id
                      )
                      if (match) {
                        setForm(p => ({ ...p, parent_id: match.id, parent_name: match.name }))
                      }
                    }
                  }}
                  list="parent-suggestions"
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
                    parentNameError
                      ? 'border-rose-500 bg-rose-500/10 focus:border-rose-500 focus:ring-rose-500/50'
                      : 'border-slate-700 bg-slate-800/60 focus:border-indigo-500 focus:ring-indigo-500/50'
                  }`}
                  placeholder="输入父节点名称或从列表选择…"
                  autoComplete="off"
                />
                <datalist id="parent-suggestions">
                  {parentOptions
                    .filter(n => n.id !== editingNode?.id)
                    .map(n => (
                      <option key={n.id} value={n.name}>
                        {n.name} ({n.department}部)
                      </option>
                    ))}
                </datalist>
                {/* 反馈提示 */}
                {form.parent_name && form.parent_id && (
                  <p className="mt-1 text-[0.6rem] text-emerald-400">
                    📁 挂载到已有父节点「{form.parent_name}」
                  </p>
                )}
                {form.parent_name && !form.parent_id && (
                  <p className="mt-1 text-[0.6rem] text-amber-400">
                    🆕 将自动创建新的父节点「{form.parent_name}」
                  </p>
                )}
                {parentNameError && (
                  <p className="mt-1 text-[0.6rem] text-rose-400">{parentNameError}</p>
                )}
              </div>
              {form.parent_name && (
                <button type="button" onClick={() => setForm(p => ({ ...p, parent_id: '', parent_name: '' }))}
                  className="mt-1.5 text-[0.65rem] text-slate-500 hover:text-slate-300 transition-colors">
                  ✕ 清除父节点（作为根节点）
                </button>
              )}
              <p className="mt-1 text-[0.65rem] text-slate-600">支持两种方式：① 从列表选择已有节点 ② 输入新名称自动创建父节点</p>
            </div>
            )}
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">技能层级 *</label>
              <div className="grid grid-cols-3 gap-2">
                {([{ key: 'basic', label: '🌱 基础素养', desc: '通用基础能力' },
                   { key: 'department', label: '🔧 部门专精', desc: '核心专业技能' },
                   { key: 'advanced', label: '🚀 进阶业务', desc: '高阶思维拓展' },
                ] as const).map(cat => (
                  <button key={cat.key} type="button" onClick={() => setForm(p => ({ ...p, category: cat.key }))}
                    className={`rounded-lg border px-3 py-2 text-left transition-all duration-200 ${
                      form.category === cat.key
                        ? cat.key === 'basic' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : cat.key === 'department' ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                          : 'border-violet-500/50 bg-violet-500/10 text-violet-300'
                        : 'border-slate-700 bg-slate-800/40 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                    }`}>
                    <div className="text-[0.75rem] font-medium">{cat.label}</div>
                    <div className="text-[0.6rem] opacity-70">{cat.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">技能描述</label>
              <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                rows={3} placeholder="描述该技能的学习目标与内容..." />
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">排序索引</label>
              <input type="number" value={form.order_index} onChange={e => setForm(p => ({ ...p, order_index: parseInt(e.target.value) || 0 }))}
                className="w-24 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">学习资料</label>
              <div className="flex gap-2">
                <input value={newResource} onChange={e => setNewResource(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addResource() } }}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  placeholder="添加资料（文档链接、教程名称等）" />
                <button type="button" onClick={addResource}
                  className="rounded-lg bg-indigo-500/20 px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-500/30 transition-colors">添加</button>
              </div>
              {form.resources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.resources.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-slate-700/50 pl-3 pr-1 py-1 text-xs text-slate-300">
                      {r}
                      <button onClick={() => removeResource(i)} className="ml-1 rounded p-0.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">取消</button>
              <button onClick={handleSubmit} disabled={saving}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {saving ? (<><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> 保存中...</>) 
                  : editingNode ? '💾 保存修改' 
                  : isQuickAddChild ? '➕ 添加子节点'
                  : '🌳 创建根节点'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 快速发布弹窗 ── */}
      {publishNode && (
        <Modal title={`⚡ 发布技能任务 — ${publishNode.name}`} onClose={() => setPublishNode(null)}>
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 text-sm font-bold">
                  {CATEGORY_META[publishNode.category]?.icon || '🔧'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{publishNode.name}</p>
                  <p className="text-[0.6875rem] text-slate-500">{publishNode.department}部 · {CATEGORY_META[publishNode.category]?.label || '部门专精'}</p>
                </div>
              </div>
              {publishNode.description && <p className="mt-3 text-[0.75rem] text-slate-400 leading-relaxed">{publishNode.description}</p>}
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-400 mb-1.5">截止日期（可选）</label>
              <input type="date" value={publishDueDate} onChange={e => setPublishDueDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button onClick={() => setPublishNode(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 transition-colors">取消</button>
              <button onClick={handleQuickPublish} disabled={publishing}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {publishing ? '发布中...' : '🏢 发布为部门任务'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
