import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

// 扩展 Express Request 类型
declare global {
	namespace Express {
		interface Request {
			userId?: string
		}
	}
}

/**
 * JWT 鉴权中间件
 * 从 Authorization header 中提取 Bearer token 并验证
 */
export function auth(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization
	if (!header?.startsWith('Bearer ')) {
		return res.status(401).json({ error: '未提供认证令牌' })
	}

	try {
		const payload = jwt.verify(header.slice(7), config.jwtSecret) as { userId: string }
		req.userId = payload.userId
		next()
	} catch {
		return res.status(401).json({ error: '令牌无效或已过期' })
	}
}

/**
 * 生成 JWT token
 */
export function signToken(userId: string): string {
	return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' })
}
