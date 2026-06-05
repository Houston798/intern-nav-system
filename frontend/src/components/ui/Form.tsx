import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
  useState,
} from 'react'

/* ═════════════════════════════════════════
   FormField — 统一表单字段容器
   ═════════════════════════════════════════ */
function FormField({
  label,
  required,
  error,
  hint,
  children,
  fieldId,
}: {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
  fieldId: string
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="flex items-center gap-1 text-[0.8125rem] font-medium text-slate-300 select-none">
          {label}
          {required && <span className="text-rose-400 text-xs">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p
          id={`${fieldId}-error`}
          className="flex items-center gap-1 text-[0.75rem] text-rose-400 animate-slide-in-right"
          role="alert"
        >
          <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-[0.75rem] text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/* ═════════════════════════════════════════
   Input — 增强版输入框
   ═════════════════════════════════════════ */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  icon?: ReactNode
  rightIcon?: ReactNode
  onRightIconClick?: () => void
}

export function Input({
  label,
  required,
  error,
  hint,
  icon,
  rightIcon,
  onRightIconClick,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id || label?.replace(/\s/g, '-').toLowerCase() || crypto.randomUUID()
  const hasError = !!error

  return (
    <FormField label={label} required={required} error={error} hint={hint} fieldId={inputId}>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={`input ${icon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${
            hasError ? 'input-error' : ''
          } ${className}`}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        {rightIcon && (
          <button
            type="button"
            tabIndex={-1}
            onClick={onRightIconClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="操作"
          >
            {rightIcon}
          </button>
        )}
      </div>
    </FormField>
  )
}

/* ═════════════════════════════════════════
   Select — 增强版下拉
   ═════════════════════════════════════════ */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  options: { value: string; label: string; disabled?: boolean }[]
}

export function Select({
  label,
  required,
  error,
  hint,
  options,
  className = '',
  id,
  ...rest
}: SelectProps) {
  const selId = id || label?.replace(/\s/g, '-').toLowerCase() || crypto.randomUUID()
  const hasError = !!error

  return (
    <FormField label={label} required={required} error={error} hint={hint} fieldId={selId}>
      <div className="relative">
        <select
          id={selId}
          className={`input cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2214%22%20height%3D%2214%22%20fill%3D%22%2394a3b8%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.646%205.646a.5.5%200%200%201%20.708%200L8%208.293l2.646-2.647a.5.5%200%200%201%20.708.708l-3%203a.5.5%200%200%201-.708%200l-3-3a.5.5%200%200%201%200-.708z%22%2F%3E%3C%2Fsvg%3E")] bg-[length:14px] bg-[right_0.75rem_center] bg-no-repeat pr-10 ${
            hasError ? 'input-error' : ''
          } ${className}`}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${selId}-error` : undefined}
          {...rest}
        >
          {options.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </FormField>
  )
}

/* ═════════════════════════════════════════
   Textarea — 增强版多行输入
   ═════════════════════════════════════════ */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  required?: boolean
  error?: string
  hint?: string
  maxLength?: number
  showCount?: boolean
}

export function Textarea({
  label,
  required,
  error,
  hint,
  maxLength,
  showCount,
  className = '',
  id,
  onChange,
  rows = 4,
  ...rest
}: TextareaProps) {
  const taId = id || label?.replace(/\s/g, '-').toLowerCase() || crypto.randomUUID()
  const hasError = !!error
  const [charCount, setCharCount] = useState(0)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCharCount(e.target.value.length)
    onChange?.(e)
  }

  return (
    <FormField label={label} required={required} error={error} hint={hint} fieldId={taId}>
      <div className="relative">
        <textarea
          id={taId}
          className={`input resize-none ${hasError ? 'input-error' : ''} ${className}`}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${taId}-error` : hint ? `${taId}-hint` : undefined}
          rows={rows}
          maxLength={maxLength}
          onChange={handleChange}
          {...rest}
        />
        {(showCount || maxLength) && (
          <div className="absolute bottom-2 right-3 text-[0.6875rem] text-slate-500 select-none pointer-events-none">
            {showCount && <span>{charCount}</span>}
            {maxLength && <span>{showCount ? ` / ${maxLength}` : `${charCount} / ${maxLength}`}</span>}
          </div>
        )}
      </div>
    </FormField>
  )
}

/* ═════════════════════════════════════════
   SearchInput — 带搜索图标的输入框
   ═════════════════════════════════════════ */
export function SearchInput({
  value,
  onChange,
  placeholder = '搜索...',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-3 text-sm"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="清除搜索"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
