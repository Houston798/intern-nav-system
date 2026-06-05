import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api'
import { Card, EmptyState } from '../components/ui/Card'
import { PageHeader } from '../components/ui/Card'
import { Textarea } from '../components/ui/Form'
import Button from '../components/ui/Button'

type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  id: string
  timestamp: number
}

const welcomeMessages: Record<string, string> = {
  intern: '有什么工作上的疑问随时问我，我会根据你的部门背景提供针对性建议。',
  mentor: '我可以帮你撰写评估意见、生成辅导建议，或分析学员进度数据。',
  hr: '我可以协助你整理实习生档案、分析留用数据、起草通知等。',
}

const quickPrompts: Record<string, string[]> = {
  intern: [
    '我的周报怎么写比较好？给个模板',
    '如何高效组织一次跨部门会议？',
    '解释一下这个行业的常见术语和缩写',
    '如何向导师汇报工作进度？',
  ],
  mentor: [
    '帮我生成一份实习生月度评估模板',
    '如何给进度滞后的学员提供有效辅导？',
    '常见的实习生培养误区有哪些？',
    '推荐一些项目管理的最佳实践',
  ],
  hr: [
    '生成一份实习生满意度调查问卷',
    '如何统计和分析实习生留用率？',
    '起草一份实习期结束通知',
    '实习生培养体系的优化建议',
  ],
}

function AiAssistant() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (user) {
      setMessages([{
        role: 'system',
        content: `你好 ${user.name}！我是业务部${user.department || '通用'} AI 助手。${welcomeMessages[user.role] || welcomeMessages.intern}`,
        id: 'init',
        timestamp: Date.now(),
      }])
    }
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || !user) return

    const userMsg: Message = {
      role: 'user', content: text.trim(),
      id: `msg-${Date.now()}`, timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError('')

    try {
      const response = await api.post('/ai/chat', { message: userMsg.content })
      const aiMsg: Message = {
        role: 'assistant',
        content: response.data.reply || '抱歉，我暂时无法回答这个问题。',
        id: `msg-${Date.now() + 1}`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      setError('AI 服务暂时不可用。请确认后端服务已启动，并检查 API 密钥配置。')
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [loading, user])

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (input.trim()) sendMessage(input)
  }

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    const el = document.activeElement as HTMLElement
    el?.blur()
  }

  if (!user) {
    return <EmptyState icon="🤖" title="请先登录" description="登录后使用 AI 助手进行智能问答" />
  }

  const prompts = quickPrompts[user.role] || quickPrompts.intern

  return (
    <div className="page-enter flex h-[calc(100vh-10rem)] flex-col">
      <PageHeader
        title="AI 智能助手"
        subtitle={`${user.department || '通用'} 部门 · 专属智能问答`}
      />

      <Card className="flex flex-1 flex-col !p-0 !overflow-hidden">
        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar"
          role="log" aria-label="对话记录"
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* Avatar */}
              {msg.role !== 'user' && (
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs mt-1 ${
                  msg.role === 'system' ? 'bg-purple-500/20 text-purple-400' : 'bg-indigo-500/20 text-indigo-400'
                }`}>
                  {msg.role === 'system' ? 'AI' : 'AI'}
                </span>
              )}

              <div className="flex flex-col max-w-[82%] sm:max-w-[72%]">
                <div
                  className={`rounded-2xl px-4 py-3 group ${
                    msg.role === 'user'
                      ? 'bg-indigo-500/20 border border-indigo-500/20 text-white'
                      : msg.role === 'system'
                      ? 'bg-slate-800/50 border border-slate-700/30 text-slate-300 text-sm'
                      : 'bg-slate-800 border border-slate-700/50 text-slate-200'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="md-content text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  )}

                  {/* Time + Copy */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] opacity-40">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.role === 'assistant' && (
                      <button
                        className="text-[10px] text-slate-500 hover:text-slate-300 transition opacity-0 group-hover:opacity-100"
                        onClick={() => copyMessage(msg.content)}
                        title="复制回复"
                      >
                        复制
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* User Avatar */}
              {msg.role === 'user' && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white mt-1">
                  {user.name.charAt(0)}
                </span>
              )}
            </div>
          ))}

          {/* Typing */}
          {loading && (
            <div className="flex justify-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 text-xs mt-1">AI</span>
              <div className="rounded-2xl bg-slate-800 border border-slate-700/50 px-5 py-3.5">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full bg-slate-500 animate-bounce"
                      style={{ animationDelay: `${i * 120}ms` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200" role="alert">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length <= 1 && !loading && (
          <div className="border-t border-slate-800 px-4 sm:px-6 py-3">
            <p className="mb-2 text-xs text-slate-500">快速提问</p>
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt, i) => (
                <button
                  key={i}
                  className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-3.5 py-2 text-xs text-slate-300 transition hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:text-white"
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-slate-800 p-4 sm:px-6">
          <div className="flex gap-3 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`向 AI 提问... (Enter 发送，Shift+Enter 换行)`}
              className="!rounded-2xl !min-h-[48px] max-h-32 !text-sm"
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              aria-label="输入消息"
            />
            <Button
              type="submit"
              loading={loading}
              disabled={!input.trim()}
              className="shrink-0 !h-12 !w-12 !p-0 !rounded-2xl"
              aria-label="发送消息"
            >
              {!loading && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-600">AI 回复仅供参考，请以实际业务为准</p>
        </form>
      </Card>
    </div>
  )
}

export default AiAssistant
