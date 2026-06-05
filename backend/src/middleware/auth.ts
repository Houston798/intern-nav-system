import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

type TokenPayload = {
  id: string
  role: string
  name: string
  department?: string | null
}

export interface AuthRequest extends Request {
  user?: TokenPayload
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as TokenPayload
    req.user = payload
    next()
  } catch (error) {
    res.status(401).json({ error: 'Token 无效' })
  }
}
