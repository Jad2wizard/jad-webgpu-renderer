/**
 * 请求追踪中间件
 * 为每个请求生成唯一 traceId，注入到 req 和 res.locals，记录请求/响应生命周期
 */
import { Request, Response, NextFunction } from 'express'
import { createLogger, Logger } from '../utils/logger'

// 扩展 Express 类型
declare global {
	namespace Express {
		interface Request {
			traceId: string
			log: Logger
		}
	}
}

let counter = 0

function generateTraceId(): string {
	const ts = Date.now().toString(36)
	counter = (counter + 1) % 100000
	const seq = counter.toString(36).padStart(3, '0')
	const rand = Math.random().toString(36).slice(2, 6)
	return `${ts}-${seq}-${rand}`
}

export function trace(req: Request, res: Response, next: NextFunction) {
	const traceId = generateTraceId()
	req.traceId = traceId
	res.locals.traceId = traceId

	const log = createLogger(traceId)
	req.log = log

	const start = Date.now()
	log.info(`${req.method} ${req.originalUrl}`)

	// 监听响应完成
	res.on('finish', () => {
		const duration = Date.now() - start
		const level = res.statusCode >= 400 ? 'warn' : 'info'
		log[level](`${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`)
	})

	next()
}
