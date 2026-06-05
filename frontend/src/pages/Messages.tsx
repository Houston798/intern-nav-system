import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../api'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardHeader, EmptyState } from '../components/ui/Card'
import Button from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import type { Message, Contact } from '../types'

function formatTime(d: string) {
  const date = new Date(d)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) + ' ' +
    date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default function Messages() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const msgPollRef = useRef<ReturnType<typeof setInterval>>()
  const contactPollRef = useRef<ReturnType<typeof setInterval>>()
  const initRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const prevUnreadRef = useRef<Record<string, number>>({})  // 记录上次轮询的未读数
  const activeContactRef = useRef<Contact | null>(null)     // 避免 loadContacts 依赖 activeContact

  // 同步 activeContact 到 ref
  useEffect(() => { activeContactRef.current = activeContact }, [activeContact])

  /* ── 浏览器通知权限 ────────────────── */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  /* ── 加载联系人（独立轮询，带新消息检测） ── */
  const loadContacts = useCallback(async () => {
    try {
      const res = await api.get('/messages/contacts')
      const list = Array.isArray(res.data) ? res.data : []

      // 检测新消息：比较未读数变化
      const prev = prevUnreadRef.current
      const curActive = activeContactRef.current
      list.forEach((c: Contact) => {
        const oldUnread = prev[c.id] || 0
        const newUnread = c.unread || 0
        if (newUnread > oldUnread && c.id !== curActive?.id) {
          // 对非当前选中联系人的新消息，弹出 Toast
          addToast('info', `${c.name}：${newUnread} 条新消息`)

          // 页面不在前台时，发送浏览器通知
          if (
            'Notification' in window &&
            Notification.permission === 'granted' &&
            document.visibilityState !== 'visible'
          ) {
            new Notification('新留言', {
              body: `${c.name} 发来了新消息`,
              icon: '/vite.svg',
              tag: `msg-${c.id}`,
            })
          }
        }
        prev[c.id] = newUnread
      })
      prevUnreadRef.current = prev

      setContacts(list)
      // 仅在首次加载时自动选中
      if (!initRef.current && list.length > 0) {
        initRef.current = true
        const firstUnread = list.find((c: Contact) => c.unread > 0)
        setActiveContact(firstUnread || list[0])
      }
    } catch (e) {
      console.error('[Messages] loadContacts failed:', e)
    } finally {
      setLoading(false)
    }
  }, [addToast])

  /* ── 加载对话（带请求取消） ────────────────── */
  const loadMessages = useCallback(async () => {
    if (!activeContact) return
    // 取消上一次未完成的请求，防止竞态
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await api.get(`/messages/conversation/${activeContact.id}`, {
        signal: controller.signal,
      })
      setMessages(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
      console.error('[Messages] loadMessages failed:', e)
    }
  }, [activeContact])

  // 初次加载联系人和对话
  useEffect(() => { loadContacts() }, [loadContacts])

  // 联系人列表：每 5 秒独立轮询（保证未读徽章实时更新）
  useEffect(() => {
    contactPollRef.current = setInterval(loadContacts, 5000)
    return () => { if (contactPollRef.current) clearInterval(contactPollRef.current) }
  }, [loadContacts])

  // 当选中的联系人从列表中消失时，自动切换到第一个
  useEffect(() => {
    if (!activeContact || contacts.length === 0) return
    if (!contacts.find(c => c.id === activeContact.id)) {
      setActiveContact(contacts[0])
    }
  }, [contacts, activeContact])

  // 对话消息：每 3 秒轮询 + activeContact 变化时立即刷新
  useEffect(() => {
    loadMessages()
    msgPollRef.current = setInterval(loadMessages, 3000)
    return () => {
      if (msgPollRef.current) clearInterval(msgPollRef.current)
      // 组件卸载或切换联系人时，取消进行中的请求
      if (abortRef.current) abortRef.current.abort()
    }
  }, [loadMessages])

  // 自动滚到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── 发送消息 ──────────────────────── */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeContact || sending) return
    setSending(true)
    try {
      const res = await api.post('/messages/send', {
        receiver_id: activeContact.id,
        content: input.trim(),
      })
      setMessages(prev => [...prev, res.data])
      setInput('')
      // 刷新联系人列表
      loadContacts()
    } catch {
      addToast('error', '发送失败，请重试')
    } finally {
      setSending(false)
    }
  }, [input, activeContact, sending, addToast, loadContacts])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  /* ── Guard ──────────────────────────── */
  if (!user) return <EmptyState icon="🔒" title="请先登录" description="登录后查看留言" />

  /* ── Render ──────────────────────────── */
  return (
    <div className="page-enter space-y-4 h-[calc(100vh-8rem)] flex flex-col">
      {/* ── Header ────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white">留言板</h1>
        <p className="mt-1 text-sm text-slate-400">
          {user.role === 'intern'
            ? '向导师留言提问，获取指导和反馈'
            : user.role === 'mentor'
            ? '查看实习生的留言，及时回复指导'
            : '查看实习生与导师的沟通情况'}
        </p>
      </div>

      {/* ── Chat Layout ──────────────────── */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* ── Contact List (Sidebar) ───────── */}
        <div className="w-64 shrink-0 rounded-2xl border border-slate-700/50 bg-slate-900/60 flex flex-col overflow-hidden hidden sm:flex">
          <div className="px-4 py-3 border-b border-slate-700/30">
            <p className="text-[0.75rem] font-semibold text-slate-400 uppercase tracking-[0.08em]">
              {user.role === 'intern' ? '我的导师' : user.role === 'mentor' ? '我的实习生' : '联系人'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-lg bg-slate-800/40 animate-pulse" />
                ))}
              </div>
            ) : contacts.length > 0 ? (
              <div className="p-2 space-y-0.5">
                {contacts.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => setActiveContact(contact)}
                    className={`w-full flex items-center gap-3 rounded-lg p-2.5 text-left transition-all ${
                      activeContact?.id === contact.id
                        ? 'bg-indigo-500/15 border border-indigo-500/20'
                        : 'hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                        {contact.name.charAt(0)}
                      </span>
                      {contact.unread > 0 && activeContact?.id !== contact.id && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[1rem] px-1 flex items-center justify-center rounded-full bg-indigo-500 text-[0.6rem] font-bold text-white">
                          {contact.unread > 99 ? '99+' : contact.unread}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium text-white truncate">{contact.name}</p>
                      <p className="text-[0.6875rem] text-slate-500 truncate">
                        {contact.role === 'intern' ? '实习生' : contact.role === 'mentor' ? '导师' : 'HR'}
                        {contact.department ? ` · ${contact.department}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <p className="text-[0.75rem] text-slate-600 text-center">
                  {user.role === 'intern' ? '暂无导师' : '暂无实习生'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile Contact Selector ──────── */}
        <div className="sm:hidden w-full">
          <select
            className="input cursor-pointer text-[0.8125rem] w-full mb-3"
            value={activeContact?.id || ''}
            onChange={e => {
              const c = contacts.find(ct => ct.id === e.target.value)
              if (c) setActiveContact(c)
            }}
          >
            <option value="">选择联系人…</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.unread > 0 ? `(${c.unread})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* ── Chat Area ────────────────────── */}
        <div className="flex-1 rounded-2xl border border-slate-700/50 bg-slate-900/60 flex flex-col min-h-0 overflow-hidden">
          {activeContact ? (
            <>
              {/* Chat Header */}
              <div className="px-5 py-3 border-b border-slate-700/30 flex items-center gap-3 shrink-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shrink-0">
                  {activeContact.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{activeContact.name}</p>
                  <p className="text-[0.6875rem] text-slate-500">
                    {activeContact.role === 'intern' ? '实习生' : activeContact.role === 'mentor' ? '导师' : 'HR'}
                    {activeContact.department ? ` · ${activeContact.department}` : ''}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 no-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <span className="text-3xl block mb-2">💬</span>
                      <p className="text-sm text-slate-500">还没有消息，发送第一条留言吧</p>
                    </div>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender_id === user.id
                    return (
                      <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] sm:max-w-[65%] ${isMine ? 'items-end' : 'items-start'}`}>
                          {/* Sender name (only for others) */}
                          {!isMine && (
                            <p className="text-[0.65rem] text-slate-500 mb-1 pl-1">
                              {msg.sender_name || activeContact.name}
                            </p>
                          )}
                          {/* Bubble */}
                          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isMine
                              ? 'bg-indigo-500/20 text-slate-100 rounded-br-md border border-indigo-500/20'
                              : 'bg-slate-800/60 text-slate-200 rounded-bl-md border border-slate-700/30'
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          {/* Time */}
                          <p className={`text-[0.6rem] text-slate-600 mt-1 ${isMine ? 'text-right pr-1' : 'text-left pl-1'}`}>
                            {formatTime(msg.created_at)}
                            {isMine && msg.is_read && <span className="ml-1 text-indigo-400">已读</span>}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="px-4 py-3 border-t border-slate-700/30 shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入留言内容… (Enter 发送，Shift+Enter 换行)"
                    rows={1}
                    className="input flex-1 resize-none text-[0.8125rem] min-h-[2.5rem] max-h-24"
                    disabled={sending}
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    className="shrink-0 self-end"
                  >
                    {sending ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon="💬"
                title="选择联系人"
                description={contacts.length === 0
                  ? (user.role === 'intern' ? '你还没有分配导师' : '暂无实习生')
                  : '从左侧列表选择联系人开始对话'}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
