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

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/skills', skillsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/ai', aiRouter)
app.use('/api/onboarding', onboardingRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/mentor-tasks', mentorTasksRouter)
app.use('/api/department-tasks', departmentTasksRouter)
app.use('/api/user-skill-tasks', userSkillTasksRouter)
app.get('/api/health', (_, res) => res.json({ status: 'ok' }))
app.get('/', (_, res) => res.json({ status: 'intern-nav backend', docs: '/api' }))

// 调试：404 处理器，显示收到的请求信息
app.use((req: any, res) => {
  res.status(404).json({
    error: 'Not Found',
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl,
    path: req.path,
    debug: req._debugOriginalUrl || 'N/A'
  })
})

const PORT = process.env.PORT || 3001

// 仅当直接运行时启动监听（start.ts 会自己调用 listen）
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 后端运行在 http://localhost:${PORT}`)
  })
}

export default app
