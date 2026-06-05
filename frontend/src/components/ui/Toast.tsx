import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Toast, ToastType } from '../../types'

type ToastContextType = {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, exiting: true } : t)))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250)
  }, [])

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `toast-${++toastId}`
      setToasts(prev => [...prev.slice(-4), { id, type, message }])
      setTimeout(() => removeToast(id), 4000)
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3"
        role="status"
        aria-live="polite"
        aria-label="通知"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }
  const styles: Record<ToastType, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    info: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200',
  }

  return (
    <div
      className={`${toast.exiting ? 'toast-exit' : 'toast-enter'} flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${styles[toast.type]}`}
      role="alert"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
        {icons[toast.type]}
      </span>
      <p className="text-sm">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="ml-2 flex h-6 w-6 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
        aria-label="关闭通知"
      >
        ✕
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
