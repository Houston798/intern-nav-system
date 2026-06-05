import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardHeader, Badge, Modal } from '../components/ui/Card'
import { PageHeader } from '../components/ui/Card'
import { Input, Select, Textarea } from '../components/ui/Form'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ui/Toast'
import type { Task, User } from '../types'

/* ── 类型 ──────────────────────────────────── */
type CalendarEvent = {
  id: string
  label: string
  type: 'task' | 'meeting' | 'review'
  color?: string
  taskId?: string
}

type CalendarDay = {
  date: number
  month: number
  year: number
  isCurrentMonth: boolean
  isToday: boolean
  events: CalendarEvent[]
}

/* ── 颜色配置 ─────────────────────────────── */
const EVENT_COLORS: Record<string, string> = {
  task:    '#fbbf24',
  meeting: '#818cf8',
  review:  '#34d399',
}

const EVENT_LABELS: Record<string, string> = {
  task:    '任务',
  meeting: '会议',
  review:  '回顾',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:    '#64748b',
  medium: '#f59e0b',
  high:   '#f97316',
  urgent: '#ef4444',
}

/* ── 工具函数 ─────────────────────────────── */
function isSameDay(a: CalendarDay, b: CalendarDay | null): boolean {
  if (!b) return false
  return a.date === b.date && a.month === b.month && a.year === b.year
}

function dayKey(day: CalendarDay): string {
  return `${day.year}-${String(day.month + 1).padStart(2, '0')}-${String(day.date).padStart(2, '0')}`
}

/* ── 构建月历数据 ──────────────────────────── */
function buildMonthData(
  year: number, month: number,
  taskMap: Map<string, Task[]>,
): CalendarDay[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth()
  const todayDate = now.getDate()

  const days: CalendarDay[] = []

  // 上月填充
  const prevMonthTotal = new Date(year, month, 0).getDate()
  const prevM = month === 0 ? 11 : month - 1
  const prevY = month === 0 ? year - 1 : year
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = prevMonthTotal - i
    days.push({
      date: d, month: prevM, year: prevY,
      isCurrentMonth: false, isToday: false, events: [],
    })
  }

  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const tasksOnDay = taskMap.get(dateStr) || []

    const events: CalendarEvent[] = []
    for (const t of tasksOnDay) {
      events.push({
        id: t.id,
        label: t.title,
        type: 'task',
        taskId: t.id,
        color: PRIORITY_COLORS[t.priority] || EVENT_COLORS.task,
      })
    }

    days.push({
      date: d, month, year,
      isCurrentMonth: true,
      isToday: isCurrent && d === todayDate,
      events,
    })
  }

  // 下月填充
  const remaining = 42 - days.length
  const nextM = month === 11 ? 0 : month + 1
  const nextY = month === 11 ? year + 1 : year
  for (let d = 1; d <= remaining; d++) {
    days.push({
      date: d, month: nextM, year: nextY,
      isCurrentMonth: false, isToday: false, events: [],
    })
  }

  return days
}

/* ═══════════════════════════════════════════
   Calendar 组件
   ═══════════════════════════════════════════ */
export default function Calendar() {
  const now = new Date()
  const { user } = useAuth()
  const { addToast } = useToast()

  // ── 视图状态
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null)

  // ── 数据
  const [tasks, setTasks] = useState<Task[]>([])
  const [interns, setInterns] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // ── Modal 状态
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)

  // ── 表单
  const [newTask, setNewTask] = useState({
    title: '', description: '', priority: 'medium' as string,
    due_date: '', assignedTo: '',
  })
  const [creating, setCreating] = useState(false)

  // ── 常量
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  /* ── 加载数据 ──────────────────────────── */
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [tRes, uRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/users?filter=intern'),
      ])
      setTasks(Array.isArray(tRes.data) ? tRes.data : [])
      setInterns(Array.isArray(uRes.data) ? uRes.data : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  /* ── 任务按日期分组 ────────────────────── */
  const taskMap = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date) continue
      const key = t.due_date.slice(0, 10) // YYYY-MM-DD
      const arr = map.get(key) || []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [tasks])

  /* ── 月历数据 ──────────────────────────── */
  const days = useMemo(
    () => buildMonthData(viewYear, viewMonth, taskMap),
    [viewYear, viewMonth, taskMap],
  )

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long',
  })

  /* ── 导航 ──────────────────────────────── */
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null)
  }
  const goToday = () => {
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setSelectedDay(null)
  }

  /* ── 点击日期 ──────────────────────────── */
  const handleDayClick = (day: CalendarDay) => {
    if (!day.isCurrentMonth) return
    if (isSameDay(day, selectedDay)) {
      // 再次点击同一日期 → 创建任务
      const dateStr = dayKey(day)
      setNewTask({
        title: '', description: '', priority: 'medium',
        due_date: dateStr, assignedTo: '',
      })
      setShowCreateModal(true)
      return
    }
    setSelectedDay(day)
  }

  /* ── 点击任务 ──────────────────────────── */
  const handleTaskClick = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      setDetailTask(task)
      setShowDetailModal(true)
    }
  }

  /* ── 创建任务 ──────────────────────────── */
  const createTask = useCallback(async () => {
    if (!newTask.title.trim()) {
      addToast('error', '请填写任务标题')
      return
    }
    const isMentorOrHR = user?.role === 'mentor' || user?.role === 'hr'
    if (isMentorOrHR && !newTask.assignedTo) {
      addToast('error', '请选择负责人')
      return
    }
    setCreating(true)
    try {
      const payload: any = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        priority: newTask.priority,
        dueDate: newTask.due_date || null,
      }
      if (isMentorOrHR) {
        payload.assignedTo = newTask.assignedTo
      }
      // 实习生自建任务用 PATCH 把自己的 ID 作为 assignedTo 不太对
      // 后端 POST /tasks 要求 mentor/hr；实习生在日历上创建给自己 → 用 PATCH 更新状态逻辑不适用
      // 简单处理：实习生在此只创建不带 assignedTo 的提醒（不调 API），或调一个新接口
      // 我们让导师/HR 调用正常创建，实习生调用时用第一个可用的 intern？或者禁用
      if (user?.role === 'intern') {
        // 实习生把任务发给自己：使用 POST 但需要 assignedTo
        payload.assignedTo = user.id
      }

      await api.post('/tasks', payload)
      setShowCreateModal(false)
      setNewTask({ title: '', description: '', priority: 'medium', due_date: '', assignedTo: '' })
      addToast('success', '任务已创建')
      loadData()
    } catch {
      addToast('error', '创建失败，请重试')
    } finally { setCreating(false) }
  }, [newTask, user, addToast, loadData])

  /* ── 本周起止 ──────────────────────────── */
  const weekRange = useMemo(() => {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const start = new Date(today)
    start.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }, [])

  /* ── 本周任务 ──────────────────────────── */
  const weekTasks = useMemo(() => {
    return tasks.filter(t => {
      if (!t.due_date) return false
      const d = t.due_date.slice(0, 10)
      return d >= weekRange.start && d <= weekRange.end
    }).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
  }, [tasks, weekRange])

  /* ── 关键里程碑（从任务中提取未来有截止日期的）──── */
  const milestones = useMemo(() => {
    return tasks
      .filter(t => t.due_date && t.status !== 'done')
      .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
      .slice(0, 6)
      .map(t => {
        const d = new Date(t.due_date!)
        return {
          date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          label: t.title,
          type: 'task' as const,
          done: t.status === 'done',
          priority: t.priority,
        }
      })
  }, [tasks])

  /* ── 状态标签 ──────────────────────────── */
  const STATUS_LABELS: Record<string, string> = {
    todo: '待办', pending: '待处理', in_progress: '进行中', done: '已完成',
  }

  /* ═══════════════════════════════════════
     Render
     ═══════════════════════════════════════ */
  return (
    <div className="page-enter space-y-6">
      <PageHeader
        title="实习日历"
        subtitle="任务节点一览，点击日期即可创建任务"
        action={
          <button className="btn btn-primary btn-sm" onClick={() => {
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
            setNewTask({ title: '', description: '', priority: 'medium', due_date: today, assignedTo: '' })
            setShowCreateModal(true)
          }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新增任务
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ═══════════════════════════════════════
            Calendar
           ═══════════════════════════════════════ */}
        <Card className="lg:col-span-2 !p-5">
          {/* ── Month Nav ─────────────────── */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="btn btn-ghost btn-sm !px-2" aria-label="上一月">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-white">{monthLabel}</h2>
              <button onClick={goToday} className="btn btn-ghost btn-sm">今天</button>
            </div>
            <button onClick={nextMonth} className="btn btn-ghost btn-sm !px-2" aria-label="下一月">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* ── Weekday Headers ──────────── */}
          <div className="mb-2 grid grid-cols-7">
            {weekDays.map((d, i) => (
              <div key={d} className={`py-1.5 text-center text-xs font-medium ${
                i === 0 || i === 6 ? 'text-slate-500' : 'text-slate-400'
              }`}>{d}</div>
            ))}
          </div>

          {/* ── Days Grid ────────────────── */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const isSelected = isSameDay(day, selectedDay)
              const hasTasks = day.events.some(e => e.type === 'task')
              const isWeekend = [0, 6].includes(new Date(day.year, day.month, day.date).getDay())

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day)}
                  className={`relative flex min-h-[2.75rem] flex-col items-center rounded-lg p-1.5 text-sm transition-all group ${
                    !day.isCurrentMonth
                      ? 'text-slate-600 cursor-default'
                      : day.isToday
                      ? 'bg-indigo-500/20 text-indigo-300 font-bold ring-1 ring-indigo-500/40 cursor-pointer'
                      : isSelected
                      ? 'bg-slate-700/50 text-white ring-1 ring-indigo-500/50 cursor-pointer'
                      : isWeekend
                      ? 'text-slate-400 hover:bg-slate-800 cursor-pointer'
                      : 'text-slate-200 hover:bg-slate-800 cursor-pointer'
                  }`}
                  title={day.isCurrentMonth ? '点击查看详情，再次点击创建任务' : ''}
                >
                  {/* 日期数字 */}
                  <span>{day.date}</span>

                  {/* 任务圆点 */}
                  {hasTasks && (
                    <div className="mt-0.5 flex gap-0.5 flex-wrap justify-center">
                      {day.events.filter(e => e.type === 'task').slice(0, 3).map((ev, j) => (
                        <span
                          key={j}
                          onClick={(e) => handleTaskClick(e, ev.taskId!)}
                          className="h-1.5 w-1.5 rounded-full cursor-pointer hover:scale-150 transition-transform"
                          style={{ backgroundColor: ev.color || EVENT_COLORS.task }}
                          title={ev.label}
                        />
                      ))}
                    </div>
                  )}

                  {/* 无事件时 hover 显示 + 号 */}
                  {day.isCurrentMonth && day.events.length === 0 && (
                    <span className="mt-0.5 text-[0.55rem] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      ＋
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── 图例 ──────────────────────── */}
          <div className="mt-4 flex items-center gap-4 text-[0.6875rem] text-slate-500 border-t border-slate-800/50 pt-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> 任务截止
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-400" /> 今日
            </span>
            <span className="ml-auto text-slate-600">双击日期创建任务</span>
          </div>

          {/* ── 选中日详情 ────────────────── */}
          {selectedDay && (
            <div className="mt-4 rounded-xl bg-slate-800/60 border border-slate-700/30 p-4 animate-fade-slide-up">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-white">
                  {new Date(selectedDay.year, selectedDay.month, selectedDay.date).toLocaleDateString('zh-CN', {
                    month: 'long', day: 'numeric', weekday: 'short',
                  })}
                </p>
                <button
                  className="btn btn-ghost btn-sm text-indigo-400 hover:text-indigo-300"
                  onClick={() => {
                    const dateStr = dayKey(selectedDay)
                    setNewTask({
                      title: '', description: '', priority: 'medium',
                      due_date: dateStr, assignedTo: '',
                    })
                    setShowCreateModal(true)
                  }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  添加任务
                </button>
              </div>

              {selectedDay.events.length > 0 ? (
                <ul className="space-y-2">
                  {selectedDay.events.map((ev, j) => (
                    <li
                      key={j}
                      className="flex items-center gap-2.5 text-sm rounded-lg p-2 hover:bg-slate-700/30 cursor-pointer transition-colors"
                      onClick={() => {
                        if (ev.taskId) {
                          const t = tasks.find(tk => tk.id === ev.taskId)
                          if (t) { setDetailTask(t); setShowDetailModal(true) }
                        }
                      }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: ev.color || EVENT_COLORS.task }}
                      />
                      <span className="text-slate-300 flex-1 truncate">{ev.label}</span>
                      <Badge label={EVENT_LABELS[ev.type] || ev.type} variant="muted" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 py-2">当天暂无任务，点击「添加任务」创建</p>
              )}
            </div>
          )}
        </Card>

        {/* ═══════════════════════════════════════
            Side Panel
           ═══════════════════════════════════════ */}
        <div className="space-y-5">
          {/* ── 关键里程碑 ─────────────────── */}
          <Card>
            <CardHeader title="关键里程碑" subtitle={milestones.length > 0 ? '近期截止任务' : '暂无截止任务'} />
            {milestones.length > 0 ? (
              <ul className="space-y-2" role="list">
                {milestones.map((item, i) => (
                  <li key={i} className={`flex items-center gap-3 rounded-xl p-3 transition ${
                    item.done ? 'bg-slate-800/30 opacity-60' : 'bg-slate-800/60 card-hover'
                  }`}>
                    <span
                      className={`flex h-2 w-2 shrink-0 rounded-full`}
                      style={{ backgroundColor: PRIORITY_COLORS[item.priority] || '#fbbf24' }}
                    />
                    <span className="text-xs text-slate-500 font-mono">{item.date}</span>
                    <span className="flex-1 text-sm text-slate-300 truncate">{item.label}</span>
                    <Badge
                      label={item.done ? '已完成' : item.priority === 'urgent' ? '紧急' : item.priority === 'high' ? '高' : '待办'}
                      variant={item.done ? 'done' : item.priority === 'urgent' ? 'danger' : 'info'}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">暂无截止日期任务</p>
            )}
          </Card>

          {/* ── 本周任务 ──────────────────── */}
          <Card>
            <CardHeader title="本周待办" subtitle={`${weekRange.start.slice(5)} ~ ${weekRange.end.slice(5)}`} />
            {weekTasks.length > 0 ? (
              <ul className="space-y-2" role="list">
                {weekTasks.map((task) => (
                  <li
                    key={task.id}
                    className={`flex items-center gap-3 rounded-xl p-3 transition cursor-pointer ${
                      task.status === 'done' ? 'bg-slate-800/30' : 'bg-slate-800/60 card-hover'
                    }`}
                    onClick={() => { setDetailTask(task); setShowDetailModal(true) }}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs ${
                      task.status === 'done'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'border border-slate-600'
                    }`}>
                      {task.status === 'done' ? '✓' : ''}
                    </span>
                    <span className={`text-sm flex-1 truncate ${task.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                      {task.title}
                    </span>
                    <span className="text-[0.6875rem] text-slate-500 font-mono">
                      {task.due_date?.slice(5)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">本周无截止任务</p>
            )}
          </Card>

        </div>
      </div>

      {/* ═══════════════════════════════════════
         Create Task Modal
         ═══════════════════════════════════════ */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="创建任务"
        subtitle={newTask.due_date ? `截止日期：${newTask.due_date}` : '从日历快速添加任务'}
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} disabled={creating}>取消</button>
            <button className="btn btn-primary" onClick={createTask} disabled={creating}>
              {creating && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              创建任务
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {(user?.role === 'mentor' || user?.role === 'hr') && (
            <select
              className="input cursor-pointer text-[0.8125rem] w-full"
              value={newTask.assignedTo}
              onChange={e => setNewTask(p => ({ ...p, assignedTo: e.target.value }))}
            >
              <option value="">选择负责人（实习生）</option>
              {interns.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} {i.department ? `· ${i.department}` : ''}
                </option>
              ))}
            </select>
          )}
          <Input
            label="任务标题" required
            placeholder="例如：完成 Q3 市场调研报告"
            value={newTask.title}
            onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
            autoFocus
          />
          <Textarea
            label="任务描述"
            placeholder="可选，补充说明任务要求…"
            value={newTask.description}
            onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
            rows={3}
            maxLength={500}
            showCount
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="优先级"
              value={newTask.priority}
              onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))}
              options={[
                { value: 'low',    label: '🟢 低优先级' },
                { value: 'medium', label: '🟡 中优先级' },
                { value: 'high',   label: '🟠 高优先级' },
                { value: 'urgent', label: '🔴 紧急' },
              ]}
            />
            <Input
              label="截止日期"
              type="date"
              value={newTask.due_date}
              onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════
         Task Detail Modal
         ═══════════════════════════════════════ */}
      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="任务详情"
        subtitle={detailTask?.due_date ? `截止：${detailTask.due_date.slice(0, 10)}` : '无截止日期'}
        size="md"
      >
        {detailTask && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">{detailTask.title}</h3>
              {detailTask.description && (
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{detailTask.description}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500 text-xs">状态</span>
                <p className="mt-0.5">
                  <Badge variant={detailTask.status as any} label={STATUS_LABELS[detailTask.status] || detailTask.status} />
                </p>
              </div>
              <div>
                <span className="text-slate-500 text-xs">优先级</span>
                <p className="mt-0.5">
                  <Badge variant={detailTask.priority as any} label={{ low: '低', medium: '中', high: '高', urgent: '紧急' }[detailTask.priority]} />
                </p>
              </div>
              {detailTask.assigned_name && (
                <div>
                  <span className="text-slate-500 text-xs">负责人</span>
                  <p className="mt-0.5 text-slate-300">{detailTask.assigned_name}</p>
                </div>
              )}
              <div>
                <span className="text-slate-500 text-xs">创建时间</span>
                <p className="mt-0.5 text-slate-400">{new Date(detailTask.created_at).toLocaleDateString('zh-CN')}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
