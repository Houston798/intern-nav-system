import { useEffect, useState, useCallback } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Card, EmptyState, SkeletonCard, PageHeader, StatCard, Badge } from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'
import type { SkillTreeNode, SkillTreeResponse, SkillGrouped } from '../types'

/* ── 分类配置 ─────────────────────── */
const CATEGORY_META = {
  basic:       { label: '基础素养', icon: '🌱', desc: '胜任岗位所需的基础能力', color: 'emerald', barColor: 'bg-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', textColor: 'text-emerald-400' },
  department:  { label: '部门专精', icon: '🔧', desc: '岗位核心专业技能', color: 'indigo', barColor: 'bg-indigo-500', bgColor: 'bg-indigo-500/10', borderColor: 'border-indigo-500/20', textColor: 'text-indigo-400' },
  advanced:    { label: '进阶业务', icon: '🚀', desc: '高阶思维与业务拓展', color: 'violet', barColor: 'bg-violet-500', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/20', textColor: 'text-violet-400' },
} as const

type CategoryKey = keyof typeof CATEGORY_META

/* ── 工具函数 ─────────────────────── */
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

export default function SkillTree() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [grouped, setGrouped] = useState<SkillGrouped[]>([])
  const [department, setDepartment] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('basic')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // 加载部门列表
  useEffect(() => {
    api.get('/skills/departments').then(res => {
      const depts = res.data as string[]
      setDepartments(depts)
      if (depts.length > 0 && !department) {
        const userDept = user?.department
        if (userDept && depts.includes(userDept)) setDepartment(userDept)
        else setDepartment(depts[0])
      }
    }).catch(() => {})
  }, [user, department])

  // 加载技能树
  const fetchTree = useCallback(async (dept: string) => {
    if (!dept) return
    setLoading(true)
    setError('')
    try {
      const res = await api.get<SkillTreeResponse>(`/skills/tree?department=${encodeURIComponent(dept)}`)
      const data = res.data
      const g = data.grouped || []
      setGrouped(g)

      // 自动展开叶子节点所在的父节点
      const ids = new Set<string>()
      g.forEach(cat => {
        cat.nodes.forEach(node => {
          ids.add(node.id)
          node.children.forEach(child => {
            if (child.status !== 'locked') ids.add(child.id)
          })
        })
      })
      setExpandedIds(ids)

      // 自动选中第一个有内容的分类
      const firstHas = (['basic', 'department', 'advanced'] as CategoryKey[]).find(
        k => g.find(c => c.category === k)?.nodes.length
      )
      if (firstHas) setActiveCategory(firstHas)
    } catch {
      setError('技能树加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (department) fetchTree(department)
  }, [department, fetchTree])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // 更新技能状态
  const updateStatus = async (skillId: string, currentStatus: string) => {
    const nextStatus: Record<string, string> = {
      locked: 'in_progress',
      in_progress: 'mastered',
      mastered: 'locked',
    }
    const newStatus = nextStatus[currentStatus] || 'locked'
    setUpdatingId(skillId)
    try {
      await api.post('/skills/me', { skillId, status: newStatus })
      setGrouped(prev => prev.map(cat => ({
        ...cat,
        nodes: updateNodeStatusRecursive(cat.nodes, skillId, newStatus),
      })))
      const labels: Record<string, string> = {
        locked: '已重置为未开始', in_progress: '开始学习中 ✏️', mastered: '已掌握 🎉',
      }
      addToast('success', labels[newStatus] || '状态已更新')
    } catch {
      addToast('error', '状态更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  const updateNodeStatusRecursive = (nodes: SkillTreeNode[], id: string, status: string): SkillTreeNode[] =>
    nodes.map(node => ({
      ...node,
      status: node.id === id ? (status as SkillTreeNode['status']) : node.status,
      children: node.children.length > 0
        ? updateNodeStatusRecursive(node.children, id, status)
        : node.children,
    }))

  // 进度计算
  const allLeaves = grouped.flatMap(g => gatherLeafNodes(g.nodes))
  const totalLeaves = allLeaves.length
  const masteredLeaves = allLeaves.filter(n => n.status === 'mastered').length
  const inProgressLeaves = allLeaves.filter(n => n.status === 'in_progress').length

  // ── 渲染单个树节点 ──
  const renderNode = (node: SkillTreeNode, depth: number) => {
    const isExpanded = expandedIds.has(node.id)
    const hasChildren = node.children.length > 0
    const isUpdating = updatingId === node.id
    const isLeaf = !hasChildren

    const statusIcons: Record<string, string> = {
      mastered: '✓',
      in_progress: '▶',
      locked: '○',
    }

    return (
      <div key={node.id} className="animate-fade-slide-up" style={{ animationDelay: `${depth * 40}ms` }}>
        <div
          className={`group relative rounded-xl border transition-all duration-200 mb-1.5 cursor-pointer
            hover:shadow-md hover:shadow-white/5
            ${node.status === 'mastered'
              ? 'bg-emerald-500/8 border-emerald-500/15'
              : node.status === 'in_progress'
              ? 'bg-indigo-500/8 border-indigo-500/15'
              : 'bg-slate-800/20 border-slate-700/20 hover:bg-slate-800/30'
            }`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            {/* 展开按钮 */}
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(node.id) }}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-700/40 hover:bg-slate-700 transition-colors"
              >
                <svg className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <span className="w-6" />
            )}

            {/* 状态图标 */}
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold
              ${node.status === 'mastered'
                ? 'bg-emerald-500/20 text-emerald-400'
                : node.status === 'in_progress'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-slate-700/30 text-slate-500'
              } ${isUpdating ? 'animate-pulse' : ''}`}
            >
              {isUpdating ? (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : statusIcons[node.status] || '○'}
            </span>

            {/* 名称 + 描述 */}
            <div className="min-w-0 flex-1" onClick={() => isLeaf && updateStatus(node.id, node.status)}>
              <div className="flex items-center gap-2">
                <span className={`text-[0.8125rem] font-medium truncate ${hasChildren ? 'text-white' : 'text-slate-200'}`}>
                  {node.name}
                </span>
                {isLeaf && (
                  <Badge
                    label={node.status === 'mastered' ? '已掌握' : node.status === 'in_progress' ? '学习中' : '未开始'}
                    variant={node.status === 'mastered' ? 'success' : node.status === 'in_progress' ? 'primary' : 'default'}
                  />
                )}
              </div>
              {node.description && (
                <p className="mt-0.5 text-[0.6875rem] text-slate-500 truncate leading-relaxed">{node.description}</p>
              )}
            </div>

            {/* 操作按钮 (叶子节点) */}
            {isLeaf && (
              <button
                onClick={(e) => { e.stopPropagation(); updateStatus(node.id, node.status) }}
                disabled={isUpdating}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[0.6875rem] font-medium transition-all duration-200
                  ${node.status === 'locked'
                    ? 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/35 hover:text-indigo-200'
                    : node.status === 'in_progress'
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/35 hover:text-emerald-200'
                    : 'bg-slate-700/30 text-slate-400 hover:bg-slate-600/50 hover:text-slate-300'
                  }
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {node.status === 'locked' ? '开始' : node.status === 'in_progress' ? '完成' : '重置'}
              </button>
            )}
          </div>
        </div>

        {/* 展开子节点 + 资料 */}
        {isExpanded && (
          <div className="animate-slide-in-left">
            {isLeaf && node.resources_parsed.length > 0 && (
              <div
                className="mb-2 rounded-xl border border-dashed border-slate-700/30 bg-slate-800/15 p-3"
                style={{ marginLeft: `${depth * 20 + 26}px` }}
              >
                <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  📚 学习资料
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {node.resources_parsed.map((r, i) => (
                    <span key={i} className="rounded-lg bg-slate-700/40 px-2.5 py-1 text-[0.6875rem] text-slate-300 hover:bg-slate-700/60 transition-colors">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {hasChildren && node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // ── 空状态 ──
  if (!user) return <EmptyState icon="🔒" title="请先登录" description="登录后查看技能树" />

  return (
    <div className="page-enter space-y-5 pb-8">
      <PageHeader title="技能树" subtitle="按层级掌握业务能力，逐步成长为团队骨干">
        {/* 部门切换 */}
        {departments.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {departments.map(d => (
              <button
                key={d}
                onClick={() => setDepartment(d)}
                className={`rounded-lg px-3.5 py-1.5 text-[0.75rem] font-medium transition-all duration-200 ${
                  d === department
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                    : 'bg-slate-800/40 text-slate-400 border border-slate-700/30 hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                {d} 部
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {/* 总体统计卡片 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="📚" label="技能节点" value={loading ? '…' : totalLeaves} variant="primary" />
        <StatCard icon="✅" label="已掌握" value={loading ? '…' : masteredLeaves} variant="success" />
        <StatCard icon="📊" label="掌握率"
          value={loading ? '…' : totalLeaves > 0 ? `${Math.round((masteredLeaves / totalLeaves) * 100)}%` : '0%'}
          variant="default" />
      </div>

      {/* 错误横幅 */}
      {error && (
        <div className="alert alert-error animate-scale-in" role="alert">
          <svg className="h-5 w-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div><p className="font-medium">加载失败</p><p className="mt-0.5 text-rose-300/80 text-[0.8125rem]">{error}</p></div>
        </div>
      )}

      {/* 分类标签切换 */}
      <div className="flex gap-2 border-b border-slate-800/50 pb-0">
        {(Object.keys(CATEGORY_META) as CategoryKey[]).map(key => {
          const meta = CATEGORY_META[key]
          const catNodes = grouped.find(g => g.category === key)?.nodes || []
          const leaves = gatherLeafNodes(catNodes)
          const mastered = leaves.filter(n => n.status === 'mastered').length
          const catProgress = leaves.length > 0 ? Math.round((mastered / leaves.length) * 100) : 0
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-[0.8125rem] font-medium transition-all duration-200 ${
                activeCategory === key
                  ? `${meta.bgColor} ${meta.textColor} border-b-2 ${meta.borderColor} -mb-px`
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/20'
              }`}
            >
              <span className="text-base">{meta.icon}</span>
              <span>{meta.label}</span>
              {catProgress > 0 && (
                <span className={`text-[0.625rem] px-1.5 py-0.5 rounded-full ${meta.bgColor} ${meta.textColor}`}>
                  {catProgress}%
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 分类内容 */}
      <Card>
        {loading ? (
          <SkeletonCard lines={6} />
        ) : grouped.length > 0 ? (
          (() => {
            const activeGroup = grouped.find(g => g.category === activeCategory)
            const activeNodes = activeGroup?.nodes || []
            if (activeNodes.length === 0) {
              return (
                <EmptyState
                  icon={CATEGORY_META[activeCategory].icon}
                  title={`暂无${CATEGORY_META[activeCategory].label}技能`}
                  description="该分类下暂未配置技能节点"
                />
              )
            }

            const catLeaves = gatherLeafNodes(activeNodes)
            const catMastered = catLeaves.filter(n => n.status === 'mastered').length
            const catProgress = catLeaves.length > 0 ? Math.round((catMastered / catLeaves.length) * 100) : 0

            return (
              <>
                {/* 分类描述 + 进度 */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/30">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>{CATEGORY_META[activeCategory].icon}</span>
                      {CATEGORY_META[activeCategory].label}
                    </h3>
                    <p className="mt-1 text-[0.75rem] text-slate-500">{CATEGORY_META[activeCategory].desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.75rem] text-slate-400">
                      {catMastered} / {catLeaves.length} 已掌握
                    </span>
                    <div className="hidden sm:block h-2 w-20 rounded-full bg-slate-700/40 overflow-hidden">
                      <div className={`h-2 rounded-full transition-all duration-500 ${CATEGORY_META[activeCategory].barColor}`}
                        style={{ width: `${catProgress}%` }} />
                    </div>
                    <span className="text-[0.75rem] font-semibold text-slate-300">{catProgress}%</span>
                  </div>
                </div>

                {/* 节点列表 */}
                <div className="space-y-0.5">
                  {activeNodes.map(node => renderNode(node, 0))}
                </div>
              </>
            )
          })()
        ) : (
          <EmptyState icon="🌱" title={department ? `${department}部暂无技能树` : '暂无技能树'}
            description={user.role === 'mentor' || user.role === 'hr' ? '前往技能管理页面配置' : '联系导师为你配置学习路径'} />
        )}
      </Card>
    </div>
  )
}
