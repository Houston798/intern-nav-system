import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'

dotenv.config()

import authRouter from './routes/auth'
import usersRouter from './routes/users'
import tasksRouter from './routes/tasks'
import skillsRouter from './routes/skills'
import notificationsRouter from './routes/notifications'
import aiRouter from './routes/ai'
import onboardingRouter from './routes/onboarding'
import messagesRouter from './routes/messages'
import mentorTasksRouter from './routes/mentor-tasks'
import departmentTasksRouter from './routes/department-tasks'
import userSkillTasksRouter from './routes/user-skill-tasks'

const app = express()

// helmet 配置：关闭 CSP 以避免干扰本地开发工具
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://test-d6gc513wh1f79ab66-1436394535.tcloudbaseapp.com',
]

// Vercel 部署时允许同域请求（origin 为空或与请求同源）
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（serverless 同域调用 / Postman 等）
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true)
    } else {
      callback(null, true) // 生产环境宽松处理，避免 CORS 阻断
    }
  },
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())

// Vercel serverless: 请求路径已去掉 /api 前缀
// 本地开发: 通过 vite proxy 或直接访问 localhost:3001/api/...
const API_PREFIX = process.env.VERCEL ? '' : '/api'

app.use(`${API_PREFIX}/auth`, authRouter)
app.use(`${API_PREFIX}/users`, usersRouter)
app.use(`${API_PREFIX}/tasks`, tasksRouter)
app.use(`${API_PREFIX}/skills`, skillsRouter)
app.use(`${API_PREFIX}/notifications`, notificationsRouter)
app.use(`${API_PREFIX}/ai`, aiRouter)
app.use(`${API_PREFIX}/onboarding`, onboardingRouter)
app.use(`${API_PREFIX}/messages`, messagesRouter)
app.use(`${API_PREFIX}/mentor-tasks`, mentorTasksRouter)
app.use(`${API_PREFIX}/department-tasks`, departmentTasksRouter)
app.use(`${API_PREFIX}/user-skill-tasks`, userSkillTasksRouter)
app.get(`${API_PREFIX}/health`, (_, res) => res.json({ status: 'ok' }))
app.get('/', (_, res) => res.json({ status: 'intern-nav backend', docs: '/api' }))

const PORT = process.env.PORT || 3001

// 仅当直接运行时启动监听（start.ts 会自己调用 listen）
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 后端运行在 http://localhost:${PORT}`)
  })
}

export default app
