import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { SkillTreeNode, SkillTreeResponse } from '../types'

/* ── 右键菜单组件 ──────────────────── */
interface ContextMenuState {
  x: number
  y: number
  nodeId: string
  nodeName: string
}
function ContextMenuWidget({ menu, onRename, onAddChild, onClose }: {
  menu: ContextMenuState
  onRename: () => void
  onAddChild?: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // 调整位置防溢出
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })
  useEffect(() => {
    const el = ref.current
    if (el) {
      const r = el.getBoundingClientRect()
      let x = menu.x, y = menu.y
      if (x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8
      if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8
      if (x < 4) x = 4
      if (y < 4) y = 4
      setPos({ x, y })
    }
  }, [menu])
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', k) }
  }, [onClose])
  return (
    <div ref={ref}
      className="fixed z-[100] rounded-xl bg-slate-800/95 border border-slate-600/50 shadow-2xl py-1.5 min-w-[150px] backdrop-blur-xl animate-scale-in"
      style={{ left: pos.x, top: pos.y }}>
      <div className="px-3 py-1.5 text-[0.65rem] text-slate-500 truncate border-b border-slate-700/40 mb-1">
        📂 {menu.nodeName}
      </div>
      <button onClick={onRename}
        className="w-full flex items-center gap-2 px-3 py-2 text-[0.75rem] text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors text-left">
        <span className="w-4 text-center">✏️</span> 重命名
      </button>
      {onAddChild && (
        <button onClick={onAddChild}
          className="w-full flex items-center gap-2 px-3 py-2 text-[0.75rem] text-slate-300 hover:bg-slate-700/50 hover:text-emerald-400 transition-colors text-left">
          <span className="w-4 text-center">➕</span> 添加子节点
        </button>
      )}
    </div>
  )
}

/* ── 布局计算类型 ────────────────────── */
interface LayoutNode {
  id: string
  name: string
  category: 'basic' | 'department' | 'advanced'
  description: string | null
  status: 'locked' | 'in_progress' | 'mastered'
  resources_parsed: string[]
  children: LayoutNode[]
  parent_id: string | null
  x: number
  y: number
  width: number
  height: number
}

/* ── 状态元数据 ─────────────────────── */
const STATUS_META = {
  locked:      { label: '未解锁', color: 'slate',   bg: 'bg-slate-700/60', text: 'text-slate-400', border: 'border-slate-600/40', dot: 'bg-slate-500',   icon: '🔒' },
  in_progress: { label: '学习中', color: 'amber',   bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-400',  icon: '📖' },
  mastered:    { label: '已精通', color: 'emerald', bg: 'bg-emerald-500/15',text: 'text-emerald-400',border: 'border-emerald-500/30',dot: 'bg-emerald-400',icon: '✅' },
} as const

const CATEGORY_META = {
  basic:       { label: '基础素养', emoji: '🌱', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  department:  { label: '部门专精', emoji: '🔧', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
  advanced:    { label: '进阶业务', emoji: '🚀', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
} as const

/* ── 布局计算 ──────────────────────── */
const NODE_W = 200
const NODE_H = 80
const H_GAP = 140
const V_GAP = 160
const LEVEL_PAD = 60

function computeLayout(tree: SkillTreeNode[]): LayoutNode[] {
  const result: LayoutNode[] = []
  const levels: LayoutNode[][] = [] // levels[0]=roots, levels[1]=their children, etc.

  function collectLevel(nodes: SkillTreeNode[], level: number) {
    if (!levels[level]) levels[level] = []
    for (const n of nodes) {
      const ln: LayoutNode = {
        id: n.id, name: n.name, category: n.category,
        description: n.description, status: n.status,
        resources_parsed: n.resources_parsed, children: [],
        parent_id: n.parent_id, x: 0, y: 0, width: NODE_W, height: NODE_H,
      }
      levels[level].push(ln)
      result.push(ln)
      if (n.children && n.children.length > 0) {
        ln.children = [] // will be filled
        collectLevel(n.children, level + 1)
      }
    }
  }
  collectLevel(tree, 0)

  // 重建父子关系
  const nodeMap = new Map(result.map(n => [n.id, n]))
  for (const node of result) {
    const orig = findInTree(tree, node.id)
    if (orig && orig.children) {
      node.children = orig.children.map(c => nodeMap.get(c.id)!).filter(Boolean)
    }
  }

  // 计算位置：top-down，每层水平居中排列
  const maxNodesInLevel = Math.max(...levels.map(l => l.length), 1)
  const totalWidth = maxNodesInLevel * (NODE_W + H_GAP) - H_GAP

  for (let li = 0; li < levels.length; li++) {
    const layer = levels[li]
    const layerWidth = layer.length * (NODE_W + H_GAP) - H_GAP
    const offsetX = (totalWidth - layerWidth) / 2

    layer.forEach((node, ni) => {
      node.x = offsetX + ni * (NODE_W + H_GAP)
      node.y = li * (NODE_H + V_GAP) + LEVEL_PAD
    })
  }

  return result
}

function findInTree(nodes: SkillTreeNode[], id: string): SkillTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findInTree(n.children, id)
      if (found) return found
    }
  }
  return null
}

/* ── SVG 连线辅助 ──────────────────── */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

/* ── Props ─────────────────────────── */
interface Props {
  grouped: SkillTreeResponse['grouped']
  tree: SkillTreeNode[]
  department: string | null
  onSelectNode: (node: SkillTreeNode) => void
  selectedNodeId: string | null
  canManage?: boolean
  onAddChild?: (parentId: string) => void
  onAddRoot?: () => void
  onRename?: (nodeId: string, newName: string) => Promise<boolean>
}

/* ── 主组件 ────────────────────────── */
export default function SkillTreeView({ grouped, tree, department, onSelectNode, selectedNodeId, canManage, onAddChild, onAddRoot, onRename }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // 视图状态
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.85 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [dragViewStart, setDragViewStart] = useState({ x: 0, y: 0 })

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  // 内联重命名
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // 布局数据
  const allNodes = useMemo(() => computeLayout(tree), [tree])
  const nodeMap = useMemo(() => new Map(allNodes.map(n => [n.id, n])), [allNodes])

  // 连线
  const connections = useMemo(() => {
    const lines: { from: LayoutNode; to: LayoutNode; catColor: string }[] = []
    for (const node of allNodes) {
      for (const child of node.children) {
        lines.push({
          from: node,
          to: child,
          catColor: CATEGORY_META[node.category]?.color || '#64748b',
        })
      }
    }
    return lines
  }, [allNodes])

  // 总尺寸
  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { w: 800, h: 600 }
    const maxX = Math.max(...allNodes.map(n => n.x + NODE_W))
    const maxY = Math.max(...allNodes.map(n => n.y + NODE_H))
    return { w: Math.max(maxX + 80, 800), h: Math.max(maxY + 80, 600) }
  }, [allNodes])

  /* ── 缩放 ── */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setView(v => {
      const newScale = Math.max(0.3, Math.min(2.0, v.scale + delta))
      // 以鼠标位置为中心缩放
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const ratio = newScale / v.scale
        return {
          scale: newScale,
          x: mx - ratio * (mx - v.x),
          y: my - ratio * (my - v.y),
        }
      }
      return { ...v, scale: newScale }
    })
  }, [])

  /* ── 关闭右键菜单（提前声明，避免 TDZ）── */
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  /* ── 拖拽 ── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return // 不拦截节点点击
    closeContextMenu() // 点击画布空白处关闭右键菜单
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setDragViewStart({ x: view.x, y: view.y })
  }, [view, closeContextMenu])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setView(v => ({
      ...v,
      x: dragViewStart.x + (e.clientX - dragStart.x),
      y: dragViewStart.y + (e.clientY - dragStart.y),
    }))
  }, [dragging, dragStart, dragViewStart])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  /* ── 触摸事件（移动端） ── */
  const lastTouchRef = useRef<{ x: number; y: number; dist: number } | null>(null)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist: Math.sqrt(dx * dx + dy * dy),
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const newDist = Math.sqrt(dx * dx + dy * dy)
      const newScale = Math.max(0.3, Math.min(2.0, view.scale * (newDist / lastTouchRef.current.dist)))
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2
      setView({
        scale: newScale,
        x: mx - (newScale / view.scale) * (mx - view.x),
        y: my - (newScale / view.scale) * (my - view.y),
      })
      lastTouchRef.current = { x: mx, y: my, dist: newDist }
    }
  }, [view])

  /* ── 节点点击 ── */
  const handleNodeClick = useCallback((nodeId: string) => {
    const orig = findInTree(tree, nodeId)
    if (orig) onSelectNode(orig)
  }, [tree, onSelectNode])

  /* ── 右键菜单 ── */
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const node = findInTree(tree, nodeId)
    if (canManage && node) {
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId, nodeName: node.name })
    }
  }, [tree, canManage])

  /* ── 双击开始重命名 ── */
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    if (!canManage || !onRename) return
    const node = findInTree(tree, nodeId)
    if (!node) return
    setContextMenu(null)
    setRenamingId(nodeId)
    setRenameText(node.name)
    setRenameError('')
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }, [tree, canManage, onRename])

  /* ── 提交重命名 ── */
  const handleRenameSubmit = useCallback(async (nodeId: string) => {
    const trimmed = renameText.trim()
    if (!trimmed) { setRenameError('名称不能为空'); renameInputRef.current?.focus(); return }
    const orig = findInTree(tree, nodeId)
    if (orig && trimmed === orig.name) { setRenamingId(null); return }
    if (!onRename) { setRenamingId(null); return }
    setRenameSaving(true)
    setRenameError('')
    try {
      const ok = await onRename(nodeId, trimmed)
      if (!ok) { setRenameError('重命名失败，请重试'); renameInputRef.current?.focus() }
      else { setRenamingId(null) }
    } catch {
      setRenameError('重命名失败，请重试');
      renameInputRef.current?.focus()
    } finally { setRenameSaving(false) }
  }, [renameText, tree, onRename])

  /* ── 取消重命名 ── */
  const cancelRename = useCallback(() => { setRenamingId(null); setRenameError('') }, [])

  /* ── 缩放控制 ── */
  const zoomIn = () => setView(v => ({ ...v, scale: Math.min(2.0, v.scale + 0.15) }))
  const zoomOut = () => setView(v => ({ ...v, scale: Math.max(0.3, v.scale - 0.15) }))
  const zoomReset = () => setView({ x: 0, y: 0, scale: 0.85 })

  if (!grouped || grouped.every(g => g.nodes.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <span className="text-5xl mb-4">🌳</span>
        <p className="text-sm font-medium">该部门暂无技能树数据</p>
        <p className="text-xs mt-1 text-slate-600">请先创建技能节点</p>
      </div>
    )
  }

  return (
    <div className="relative w-full" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* 缩放控制栏 */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <div className="flex rounded-lg bg-slate-800/80 border border-slate-700/50 overflow-hidden backdrop-blur-sm">
          <button onClick={zoomOut} className="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-mono" title="缩小">−</button>
          <span className="px-2 py-1.5 text-[0.65rem] text-slate-400 font-mono border-x border-slate-700/30 min-w-[3rem] text-center">
            {Math.round(view.scale * 100)}%
          </span>
          <button onClick={zoomIn} className="px-2.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-sm font-mono" title="放大">+</button>
        </div>
        <button onClick={zoomReset} className="rounded-lg bg-slate-800/80 border border-slate-700/50 px-2.5 py-1.5 text-[0.65rem] text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors backdrop-blur-sm" title="重置视图">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* 分类图例 */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-2 backdrop-blur-sm">
        {(Object.entries(CATEGORY_META) as [string, typeof CATEGORY_META['basic']][]).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-1.5 rounded-lg bg-slate-800/70 border border-slate-700/40 px-3 py-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: meta.color }} />
            <span className="text-[0.65rem] text-slate-400">{meta.emoji} {meta.label}</span>
          </div>
        ))}
      </div>

      {/* 主画布 */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden rounded-2xl bg-slate-900/50 border border-slate-800/50 cursor-grab active:cursor-grabbing select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'none' }}
      >
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            width: bounds.w,
            height: bounds.h,
          }}
        >
          {/* SVG 连线层 */}
          <svg
            ref={svgRef}
            className="absolute inset-0 pointer-events-none"
            width={bounds.w}
            height={bounds.h}
            style={{ overflow: 'visible' }}
          >
            <defs>
              {connections.map((conn, i) => (
                <linearGradient key={i} id={`line-grad-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={conn.catColor} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={conn.catColor} stopOpacity={0.15} />
                </linearGradient>
              ))}
            </defs>
            {connections.map((conn, i) => {
              const fromCX = conn.from.x + NODE_W / 2
              const fromCY = conn.from.y + NODE_H
              const toCX = conn.to.x + NODE_W / 2
              const toCY = conn.to.y
              return (
                <path
                  key={i}
                  d={bezierPath(fromCX, fromCY, toCX, toCY)}
                  fill="none"
                  stroke={`url(#line-grad-${i})`}
                  strokeWidth={2}
                  strokeDasharray={conn.to.status === 'locked' ? '4 3' : 'none'}
                  opacity={conn.to.status === 'locked' ? 0.4 : 0.7}
                />
              )
            })}
          </svg>

          {/* 节点层 */}
          {allNodes.map(node => {
            const meta = STATUS_META[node.status]
            const catMeta = CATEGORY_META[node.category]
            const isSelected = node.id === selectedNodeId
            const isLeaf = node.children.length === 0
            const progressPct = node.status === 'mastered' ? 100 : node.status === 'in_progress' ? 50 : 0

            return (
              <div
                key={node.id}
                data-node={node.id}
                onClick={() => handleNodeClick(node.id)}
                onDoubleClick={() => handleNodeDoubleClick(node.id)}
                onContextMenu={(e) => handleNodeContextMenu(e, node.id)}
                className={`absolute rounded-xl border transition-all duration-200 cursor-pointer group
                  ${isSelected
                    ? 'ring-2 ring-indigo-400/60 shadow-lg shadow-indigo-500/20 scale-105 z-10'
                    : 'hover:shadow-lg hover:scale-102 hover:z-10'
                  }
                  ${renamingId === node.id ? '!ring-2 !ring-amber-400/60 !shadow-lg !shadow-amber-500/20 !scale-105 !z-20' : ''}
                  ${meta.bg} ${meta.border} backdrop-blur-sm`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  height: NODE_H,
                }}
              >
                {/* 进度条 */}
                <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl overflow-hidden bg-slate-800/50">
                  <div
                    className="h-full transition-all duration-500 rounded-b-xl"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: progressPct >= 100 ? '#34d399' : progressPct > 0 ? '#fbbf24' : 'transparent',
                    }}
                  />
                </div>

                {/* 内容 */}
                <div className="p-3 h-full flex flex-col justify-between">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-xs"
                      style={{ backgroundColor: catMeta.bg }}>
                      {catMeta.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      {renamingId === node.id ? (
                        /* ── 内联重命名 ── */
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input
                            ref={renameInputRef}
                            value={renameText}
                            onChange={e => { setRenameText(e.target.value); setRenameError('') }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameSubmit(node.id)
                              if (e.key === 'Escape') cancelRename()
                            }}
                            className={`w-full rounded-md border px-1.5 py-0.5 text-[0.7rem] font-semibold outline-none ${
                              renameError ? 'border-rose-500 bg-rose-500/10 text-rose-300' : 'border-amber-500/50 bg-slate-900/80 text-white focus:border-amber-400'
                            }`}
                            placeholder="输入名称…"
                            disabled={renameSaving}
                          />
                          {renameSaving && (
                            <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                        </div>
                      ) : (
                        <p className="text-[0.75rem] font-semibold text-white leading-tight truncate">
                          {node.name}
                        </p>
                      )}
                      {renamingId === node.id && renameError && (
                        <p className="text-[0.55rem] text-rose-400 mt-0.5 truncate">{renameError}</p>
                      )}
                      {renamingId !== node.id && node.description && (
                        <p className="text-[0.6rem] text-slate-500 mt-0.5 truncate leading-tight">
                          {node.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className={`inline-flex items-center gap-1 text-[0.6rem] font-medium ${meta.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                    {!isLeaf && (
                      <span className="text-[0.6rem] text-slate-600 font-mono">
                        {node.children.length}子
                      </span>
                    )}
                    {isLeaf && node.resources_parsed.length > 0 && (
                      <span className="text-[0.6rem] text-slate-600">
                        📎{node.resources_parsed.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* 选中指示器 */}
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* 导师/HR：悬停显示 "+" 添加子节点 */}
                {canManage && onAddChild && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddChild(node.id) }}
                    className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-100 hover:!opacity-100 hover:scale-110 flex items-center justify-center shadow-lg transition-all duration-150 z-20"
                    title="添加子节点"
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 提示文字 & 管理入口 */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10">
        <p className="text-[0.6rem] text-slate-600">
          🖱 滚轮缩放 · 拖拽平移 · 点击查看详情{canManage ? ' · 双击/右键编辑' : ''}
        </p>
        {canManage && onAddRoot && (
          <button onClick={onAddRoot}
            className="rounded-lg px-3 py-1.5 text-[0.7rem] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/25 transition-colors inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
            </svg>
            新建根节点
          </button>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenuWidget
          menu={contextMenu}
          onRename={() => {
            const id = contextMenu.nodeId
            closeContextMenu()
            handleNodeDoubleClick(id)
          }}
          onAddChild={onAddChild ? () => {
            const id = contextMenu.nodeId
            closeContextMenu()
            onAddChild(id)
          } : undefined}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}
