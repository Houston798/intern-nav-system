import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { db } from '../db'
import { randomUUID } from 'crypto'

const router = Router()

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1'

const DEPT_PROMPTS: Record<string, string> = {
  '商务': '你是业务部商务线的专属 AI 助手，专注于商务谈判、客户关系管理、合同审阅等领域。',
  '运营': '你是业务部运营线的专属 AI 助手，专注于用户增长、数据分析、活动策划等领域。',
  '产品': '你是业务部产品线的专属 AI 助手，专注于产品设计、需求分析、用户调研等领域。',
  default: '你是业务部实习生的 AI 助手，帮助实习生更好地完成工作任务和技能提升。',
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callDeepSeek(messages: Message[]): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 未配置')
  }

  const response = await fetch(`${DEEPSEEK_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`DeepSeek API 返回错误 ${response.status}: ${errText}`)
  }

  const data = await response.json() as any
  return data.choices?.[0]?.message?.content || '（AI 未返回有效回复）'
}

router.post('/chat', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body
    if (!message) {
      return res.status(400).json({ error: '缺少消息内容' })
    }

    const userId = req.user?.id
    const department = req.user?.role === 'mentor' ? '商务' : 'default'

    // 保存用户消息
    db.prepare('INSERT INTO ai_conversations (id, user_id, role, content) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), userId, 'user', message)

    // 获取最近对话历史作为上下文（最多 10 条）
    const history = db.prepare(
      'SELECT role, content FROM ai_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
    ).all(userId) as Message[]
    history.reverse()

    // 构建消息列表
    const systemPrompt = DEPT_PROMPTS[department] || DEPT_PROMPTS.default
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
    ]

    // 调用 DeepSeek API
    const reply = await callDeepSeek(messages)

    // 保存 AI 回复
    db.prepare('INSERT INTO ai_conversations (id, user_id, role, content) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), userId, 'assistant', reply)

    res.json({ reply })
  } catch (error: any) {
    console.error('[AI Chat Error]', error.message)
    // 降级：如果 API 不可用，返回提示而不是 500
    res.json({ reply: `AI 服务暂时不可用：${error.message}，请稍后重试。` })
  }
})

export default router
