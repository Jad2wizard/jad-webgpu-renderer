import { Router, Request, Response } from 'express'
import { eq, desc } from 'drizzle-orm'
import { auth } from '../middleware/auth'
import { db } from '../db'
import { projects, chatSessions, chatMessages } from '../db/schema'
import { runAgent } from '../agent'
import type { ChatSessionItem } from '../../shared/types'

const router = Router()

/**
 * POST /api/chat
 * 发送对话消息（SSE 流式响应）
 */
router.post('/chat', auth, async (req: Request, res: Response) => {
	const log = req.log
	const { projectId, sessionId: existingSessionId, message } = req.body
	const userId = req.userId!

	log.info(
		`[chat] request projectId=${projectId} sessionId=${existingSessionId || '(new)'} msg="${message.slice(0, 80)}"`
	)

	if (!projectId || !message) {
		log.warn('[chat] missing projectId or message')
		return res.status(400).json({ error: 'projectId 和 message 为必填项' })
	}

	// 验证项目所有权
	const proj = await db()
		.select({ id: projects.id })
		.from(projects)
		.where(eq(projects.id, projectId))
		.get()

	if (!proj) {
		log.warn(`[chat] project not found: ${projectId}`)
		return res.status(404).json({ error: '项目不存在' })
	}

	// 获取或创建对话 session
	let sessionId = existingSessionId

	if (!sessionId) {
		sessionId = crypto.randomUUID()
		log.info(`[chat] creating new session: ${sessionId}`)
		try {
			await db()
				.insert(chatSessions)
				.values({
					id: sessionId,
					projectId,
					userId,
					title: message.slice(0, 50),
				})
		} catch (err: any) {
			log.warn(`[chat] session creation failed: ${err.message}`)
		}
	} else {
		const sess = await db()
			.select({ id: chatSessions.id })
			.from(chatSessions)
			.where(eq(chatSessions.id, sessionId))
			.get()

		if (!sess) {
			log.warn(`[chat] session not found: ${sessionId}`)
			return res.status(404).json({ error: '对话不存在' })
		}
	}

	// SSE 流式响应
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		Connection: 'keep-alive',
		'X-Accel-Buffering': 'no',
		'Content-Encoding': 'none', // 禁用压缩，防止中间件缓冲
	})
	res.flushHeaders()

	if (res.socket) {
		res.socket.setNoDelay(true)
		res.socket.setTimeout(0)
	}

	const emit = (event: string, data: unknown) => {
		res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
		// 强制将底层的 response buffer 冲刷出去
		if (typeof (res as any).flush === 'function') {
			;(res as any).flush()
		}
	}

	let eventCount = 0
	let textChars = 0
	let toolCallCount = 0
	const t0 = Date.now()

	try {
		log.info(`[chat] starting agent stream sessionId=${sessionId}`)

		for await (const event of runAgent(projectId, sessionId!, message)) {
			eventCount++
			emit(event.type, event)

			switch (event.type) {
				case 'text':
					textChars += (event.content || '').length
					break
				case 'tool_call':
					toolCallCount++
					log.info(`[chat] tool_call: ${event.tool}`, event.args)
					break
				case 'tool_result':
					log.info(`[chat] tool_result: ${event.tool}`, {
						result: (event.result || '').slice(0, 120),
					})
					break
				case 'config_changed':
					log.info('[chat] config_changed')
					break
				case 'done':
					log.info(
						`[chat] done events=${eventCount} textChars=${textChars} tools=${toolCallCount} duration=${Date.now() - t0}ms sessionId=${sessionId}`
					)
					break
				case 'error':
					log.error(`[chat] agent error: ${event.message}`)
					break
			}
		}
	} catch (err) {
		log.error(`[chat] stream exception: ${err instanceof Error ? err.message : String(err)}`)
		emit('error', { message: err instanceof Error ? err.message : '对话失败' })
	} finally {
		res.end()
		log.info(`[chat] stream ended totalEvents=${eventCount} duration=${Date.now() - t0}ms`)
	}
})

/**
 * GET /api/chat/sessions
 * 获取项目的对话历史列表
 */
router.get('/chat/sessions', auth, async (req: Request, res: Response) => {
	const projectId = req.query.projectId as string
	if (!projectId) {
		return res.status(400).json({ error: '缺少 projectId 参数' })
	}

	const sessions = await db()
		.select({
			id: chatSessions.id,
			title: chatSessions.title,
			createdAt: chatSessions.createdAt,
			updatedAt: chatSessions.updatedAt,
		})
		.from(chatSessions)
		.where(eq(chatSessions.projectId, projectId))
		.orderBy(desc(chatSessions.updatedAt))
		.all()

	const result: ChatSessionItem[] = sessions.map((s) => ({
		...s,
		createdAt: s.createdAt,
		updatedAt: s.updatedAt,
	}))

	res.json({ sessions: result })
})

/**
 * GET /api/chat/sessions/:id
 * 获取对话消息记录
 */
router.get('/chat/sessions/:id', auth, async (req: Request, res: Response) => {
	const messages = await db()
		.select({
			id: chatMessages.id,
			role: chatMessages.role,
			content: chatMessages.content,
			toolCalls: chatMessages.toolCalls,
			createdAt: chatMessages.createdAt,
		})
		.from(chatMessages)
		.where(eq(chatMessages.sessionId, req.params.id))
		.orderBy(desc(chatMessages.createdAt))
		.all()

	res.json({ messages })
})

/**
 * DELETE /api/chat/sessions/:id
 * 删除对话
 */
router.delete('/chat/sessions/:id', auth, async (req: Request, res: Response) => {
	await db().delete(chatSessions).where(eq(chatSessions.id, req.params.id))

	res.json({ success: true })
})

export default router
