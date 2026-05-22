import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { eq } from 'drizzle-orm'
import { config } from '../config'
import { db } from '../db'
import { users } from '../db/schema'

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
	} catch {
		return res.status(401).json({ error: '令牌无效或已过期' })
	}

	// 校验用户是否仍存在（防止清库后旧 token 导致外键约束失败）
	const user = db().select().from(users).where(eq(users.id, req.userId!)).get()
	if (!user) {
		return res.status(401).json({ error: '用户不存在，请重新登录' })
	}

	next()
}

/**
 * 生成 JWT token
 */
export function signToken(userId: string): string {
	return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' })
}
