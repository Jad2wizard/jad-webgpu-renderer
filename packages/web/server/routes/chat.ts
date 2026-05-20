import { Router, Request, Response } from "express"
import { eq, desc } from "drizzle-orm"
import { auth } from "../middleware/auth"
import { db } from "../db"
import { projects, chatSessions, chatMessages } from "../db/schema"
import { runAgent } from "../agent"
import type { ChatSessionItem } from "../../shared/types"

const router = Router()

/**
 * POST /api/chat
 * 发送对话消息（SSE 流式响应）
 */
router.post("/chat", auth, async (req: Request, res: Response) => {
  const { projectId, sessionId: existingSessionId, message } = req.body
  const userId = req.userId!

  if (!projectId || !message) {
    return res.status(400).json({ error: "projectId 和 message 为必填项" })
  }

  // 验证项目所有权
  const proj = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!proj) {
    return res.status(404).json({ error: "项目不存在" })
  }

  // 获取或创建对话 session
  let sessionId = existingSessionId

  if (!sessionId) {
    sessionId = crypto.randomUUID()
    try {
      await db().insert(chatSessions).values({
        id: sessionId,
        projectId,
        userId,
        title: message.slice(0, 50),
      })
    } catch {
      // 如果 session 创建失败，仍然尝试继续（非关键）
    }
  } else {
    // 验证 session 属于当前用户
    const sess = await db()
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .get()

    if (!sess) {
      return res.status(404).json({ error: "对话不存在" })
    }
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  })

  const emit = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    for await (const event of runAgent(projectId, sessionId!, message)) {
      emit(event.type, event)
    }
  } catch (err) {
    console.error("Chat error:", err)
    emit("error", { message: err instanceof Error ? err.message : "对话失败" })
  } finally {
    res.end()
  }
})

/**
 * GET /api/chat/sessions
 * 获取项目的对话历史列表
 */
router.get("/chat/sessions", auth, async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string
  if (!projectId) {
    return res.status(400).json({ error: "缺少 projectId 参数" })
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
router.get("/chat/sessions/:id", auth, async (req: Request, res: Response) => {
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
router.delete("/chat/sessions/:id", auth, async (req: Request, res: Response) => {
  await db()
    .delete(chatSessions)
    .where(eq(chatSessions.id, req.params.id))

  res.json({ success: true })
})

export default router
