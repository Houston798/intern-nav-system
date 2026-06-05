import { type ReactNode, useEffect } from 'react'

/* ═════════════════════════════════════════
   Card
   ═════════════════════════════════════════ */
export function Card({
  children,
  className = '',
  hover = false,
  padding = true,
  variant = 'glass',
}: {
  children: ReactNode
  className?: string
  hover?: boolean
  padding?: boolean
  variant?: 'glass' | 'solid'
}) {
  const base = variant === 'solid' ? 'glass-solid' : 'glass'
  return (
    <div
      className={`${base} ${padding ? 'p-6' : ''} ${hover ? 'card-hover' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/* ═════════════════════════════════════════
   Card Header
   ═════════════════════════════════════════ */
export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  icon?: string
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/60 text-lg" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white truncate">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[0.8125rem] text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ═════════════════════════════════════════
   Empty State
   ═════════════════════════════════════════ */
export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="mb-4 text-4xl opacity-40" aria-hidden="true">{icon}</span>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-500 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ═════════════════════════════════════════
   Skeleton
   ═════════════════════════════════════════ */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass p-6 space-y-4" aria-hidden="true">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}

/* ═════════════════════════════════════════
   Badge
   ═════════════════════════════════════════ */
type BadgeVariant =
  | 'done' | 'mastered' | 'in_progress' | 'pending' | 'overdue' | 'locked'
  | 'low' | 'medium' | 'high' | 'urgent'
  | 'info' | 'warning' | 'danger' | 'success' | 'muted' | 'blue'

const badgeStyles: Record<string, string> = {
  done: 'badge-success', mastered: 'badge-success', success: 'badge-success',
  in_progress: 'badge-warning', warning: 'badge-warning',
  pending: 'badge-info', info: 'badge-info', blue: 'badge-blue',
  overdue: 'badge-danger', high: 'badge-danger', danger: 'badge-danger', urgent: 'badge-danger',
  locked: 'badge-muted', low: 'badge-muted', muted: 'badge-muted',
  medium: 'badge-warning',
}

const badgeLabels: Record<string, string> = {
  done: '已完成', mastered: '已掌握', success: '成功',
  in_progress: '进行中', warning: '警告',
  pending: '待处理', todo: '待办', info: '信息',
  overdue: '已逾期', high: '高', danger: '危险', urgent: '紧急',
  locked: '未解锁', low: '低', muted: '默认',
  medium: '中', blue: '蓝色',
}

export function Badge({
  label,
  variant = 'pending',
  dot = false,
  className = '',
}: {
  label?: string
  variant?: BadgeVariant | string
  dot?: boolean
  className?: string
}) {
  const style = badgeStyles[variant] || 'badge-muted'
  const display = label || badgeLabels[variant] || variant
  return (
    <span className={`badge ${dot ? 'badge-dot' : ''} ${style} ${className}`}>
      {display}
    </span>
  )
}

/* ═════════════════════════════════════════
   Modal
   ═════════════════════════════════════════ */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      document.addEventListener('keydown', handler)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handler)
        document.body.style.overflow = ''
      }
    }
  }, [open, onClose])

  if (!open) return null

  const widths: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`glass relative z-10 w-full ${widths[size]} rounded-2xl p-6 shadow-modal animate-scale-in`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-700/60 hover:text-white"
            aria-label="关闭"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="text-sm text-slate-300">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════
   Confirm Dialog
   ═════════════════════════════════════════ */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = '确认',
  cancelLabel = '取消',
  danger = false,
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-slate-300">{message}</p>
    </Modal>
  )
}

/* ═════════════════════════════════════════
   Tabs
   ═════════════════════════════════════════ */
export function Tabs({
  items,
  active,
  onChange,
}: {
  items: { key: string; label: string; count?: number }[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-800/30 p-1" role="tablist">
      {items.map(item => (
        <button
          key={item.key}
          role="tab"
          aria-selected={active === item.key}
          className={`tab-item flex-1 ${active === item.key ? 'tab-active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={`ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.625rem] font-semibold ${
              active === item.key ? 'bg-indigo-500/30 text-indigo-300' : 'bg-slate-700/50 text-slate-400'
            }`}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ═════════════════════════════════════════
   Page Header
   ═════════════════════════════════════════ */
export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumb,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  breadcrumb?: { label: string; path?: string }[]
}) {
  return (
    <div className="mb-6">
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 flex items-center gap-1.5 text-[0.75rem] text-slate-500" aria-label="面包屑导航">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg className="h-3 w-3 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              )}
              <span className={i === breadcrumb.length - 1 ? 'text-slate-400 font-medium' : ''}>
                {item.label}
              </span>
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════
   Stat Card (New)
   ═════════════════════════════════════════ */
export function StatCard({
  icon,
  label,
  value,
  trend,
  variant = 'default',
}: {
  icon: string
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down'; value: string }
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}) {
  const variantStyles: Record<string, string> = {
    default: 'bg-slate-800/30 text-slate-400',
    primary: 'bg-indigo-500/10 text-indigo-400',
    success: 'bg-emerald-500/10 text-emerald-400',
    warning: 'bg-amber-500/10 text-amber-400',
    danger: 'bg-rose-500/10 text-rose-400',
  }

  return (
    <div className="stat-card glass">
      <div className="flex items-center justify-between">
        <span className={`stat-icon ${variantStyles[variant]}`}>{icon}</span>
        {trend && (
          <span className={`stat-trend ${trend.direction}`}>
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              {trend.direction === 'up' ? (
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              )}
            </svg>
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <p className="stat-value">{value}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  )
}
