import { ChatOpenAI } from '@langchain/openai'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db'
import { projects, layers, chatMessages as chatMessagesTable, chatSessions } from '../db/schema'
import { ALL_TOOLS } from './tools'
import { config } from '../config'

// ---- 模型 ----

// 自定义 fetch：注入 reasoning_content 到 assistant 消息中（DeepSeek thinking mode 要求）
const _origFetch = globalThis.fetch
const customFetch: typeof fetch = async (url, init) => {
	if (init?.body && typeof init.body === 'string') {
		try {
			const body = JSON.parse(init.body)
			if (body.messages) {
				const reasoningMap = (model as any)._reasoningMap
				if (reasoningMap?.size) {
					for (const msg of body.messages) {
						if (msg.role === 'assistant') {
							const rc = reasoningMap.get(msg.content)
							if (rc) {
								msg.reasoning_content = rc
								reasoningMap.delete(msg.content)
							}
						}
					}
				}
				init = { ...init, body: JSON.stringify(body) }
			}
		} catch { /* JSON 解析失败则保持原样 */ }
	}
	return _origFetch(url, init)
}

const model = new ChatOpenAI({
	model: config.openaiModel,
	apiKey: config.openaiApiKey,
	configuration: {
		baseURL: config.openaiBaseUrl,
		fetch: customFetch,
	},
	temperature: 0.3,
	maxTokens: 4096,
})

// ---- 兼容 DeepSeek thinking mode：捕获并回传 reasoning_content ----

// 1. 从 API 响应 delta 中捕获 reasoning_content
const _origConvertDelta = (model as any)._convertOpenAIDeltaToBaseMessageChunk?.bind(model)
if (_origConvertDelta) {
	;(model as any)._convertOpenAIDeltaToBaseMessageChunk = function (
		delta: Record<string, any>,
		rawResponse: any,
		defaultRole?: any
	) {
		const chunk = _origConvertDelta(delta, rawResponse, defaultRole)
		if (delta.reasoning_content) {
			chunk.additional_kwargs ??= {}
			chunk.additional_kwargs.reasoning_content =
				(chunk.additional_kwargs.reasoning_content || '') + delta.reasoning_content
		}
		return chunk
	}
}

// 2. 拦截 _streamResponseChunks + 自定义 fetch 注入 reasoning_content
const _origStream = (model as any)._streamResponseChunks?.bind(model)
if (_origStream) {
	;(model as any)._streamResponseChunks = async function* (
		messages: BaseMessage[],
		options: any,
		runManager: any
	) {
		// 记录 content → reasoning_content 映射，供 customFetch 注入
		const map = new Map<string, string>()
		for (const msg of messages) {
			const rc = (msg as any).additional_kwargs?.reasoning_content
			if (rc && msg.content) {
				map.set(String(msg.content), rc)
			}
		}
		;(model as any)._reasoningMap = map
		yield* _origStream(messages, options, runManager)
	}
}

// ---- System Prompt ----

const SYSTEM_PROMPT = `你是一个专业的地图可视化助手。你可以帮助用户通过自然语言修改地图的渲染样式和视角。

## 你的能力
- 修改地图视口（中心点、缩放级别）
- 修改散点图、轨迹图、热力图的样式（颜色、大小、线宽、透明度等）
- 管理图层（显隐、排序、删除）

## 颜色约定
颜色使用 [r, g, b, a] 四元组，每个分量取值范围 0-1。
- 红色 = [1, 0, 0, 1]
- 绿色 = [0, 1, 0, 1]
- 蓝色 = [0, 0, 1, 1]
- 黄色 = [1, 1, 0, 1]
- 橙色 = [1, 0.6, 0, 1]
- 白色 = [1, 1, 1, 1]
- 黑色 = [0, 0, 0, 1]
- 透明 = [0, 0, 0, 0]

## 规则
1. 在修改配置之前，先用 get_current_config 了解当前状态
2. 如果用户没有指定图层，先用 list_layers 列出可用图层
3. 半径的单位是屏幕像素，范围 1-255
4. 缩放级别范围 1-18
5. 混合模式：normalBlending(正常)、additiveBlending(叠加增亮)、subtractiveBlending(相减变暗)
6. 修改完成后用简洁的中文确认改动
7. 如果用户说的颜色名称不在约定列表中（如"紫色"），使用你最接近的估计值（如紫色 ≈ [0.5, 0, 0.5, 1]）`

// ---- Prompt 模板 ----

const prompt = ChatPromptTemplate.fromMessages([
	['system', SYSTEM_PROMPT],
	new MessagesPlaceholder('chat_history'),
	['human', '{input}'],
	new MessagesPlaceholder('agent_scratchpad'),
])

// ---- Agent ----

const agent = createToolCallingAgent({ llm: model, tools: ALL_TOOLS, prompt })

const executor = new AgentExecutor({
	agent,
	tools: ALL_TOOLS,
	verbose: config.nodeEnv === 'development',
	maxIterations: 8,
})

// ---- 对话历史加载 ----

async function loadChatHistory(sessionId: string): Promise<BaseMessage[]> {
	const messages = await db()
		.select()
		.from(chatMessagesTable)
		.where(eq(chatMessagesTable.sessionId, sessionId))
		.orderBy(asc(chatMessagesTable.createdAt))
		.all()

	return messages.map((m: any) => {
		if (m.role === 'user') return new HumanMessage(m.content)
		if (m.role === 'assistant') {
			return new AIMessage({
				content: m.content,
				additional_kwargs: m.reasoningContent
					? { reasoning_content: m.reasoningContent }
					: {},
			})
		}
		return new HumanMessage(m.content)
	})
}

// ---- 流式执行生成器 ----

export interface AgentStreamEvent {
	type: 'text' | 'tool_call' | 'tool_result' | 'config_changed' | 'done' | 'error'
	content?: string
	tool?: string
	args?: Record<string, unknown>
	result?: string
	toolCalls?: unknown[]
	message?: string
}

export async function* runAgent(
	projectId: string,
	sessionId: string,
	userMessage: string
): AsyncGenerator<AgentStreamEvent> {
	// 1. 加载历史
	const chatHistory = await loadChatHistory(sessionId)

	// 2. 获取当前项目配置并注入用户消息
	const proj = await db().select().from(projects).where(eq(projects.id, projectId)).get()

	const layerList = await db().select().from(layers).where(eq(layers.projectId, projectId)).all()

	const currentConfig = {
		viewport: proj ? JSON.parse(proj.viewport) : {},
		tile: proj ? JSON.parse(proj.tileConfig) : {},
		layers: layerList.map((l) => ({
			id: l.id,
			name: l.name,
			type: l.type,
			visible: !!l.visible,
			level: l.level,
			config: JSON.parse(l.config),
		})),
	}

	const input = `当前项目的地图配置：\n${JSON.stringify(currentConfig, null, 2)}\n\n用户请求：${userMessage}`

	// 3. 流式执行
	let fullContent = ''
	let reasoningContent = ''
	const toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: string }> = []

	try {
		const stream = await executor.streamEvents(
			{ input, chat_history: chatHistory },
			{ version: 'v2' }
		)

		for await (const event of stream) {
			switch (event.event) {
				case 'on_chat_model_stream': {
					const chunk = event.data.chunk
					// 捕获 DeepSeek thinking mode 的 reasoning_content
					if ((chunk as any).additional_kwargs?.reasoning_content) {
						reasoningContent += (chunk as any).additional_kwargs.reasoning_content
					}
					if (chunk.content) {
						const text = typeof chunk.content === 'string' ? chunk.content : ''
						fullContent += text
						yield { type: 'text', content: text }
					}
					// 处理工具调用
					if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
						for (const tc of chunk.tool_calls) {
							if (tc.name && tc.args) {
								toolCalls.push({
									name: tc.name,
									args: tc.args as Record<string, unknown>,
								})
								yield {
									type: 'tool_call',
									tool: tc.name,
									args: tc.args as Record<string, unknown>,
								}
							}
						}
					}
					break
				}
				case 'on_tool_start': {
					// 工具开始执行
					yield {
						type: 'tool_call',
						tool: event.name,
						args: (event.data.input as Record<string, unknown>) || {},
					}
					break
				}
				case 'on_tool_end': {
					const result =
						typeof event.data.output === 'string'
							? event.data.output
							: JSON.stringify(event.data.output)
					// 更新最后一个 matching tool_call 的 result
					const last = [...toolCalls]
						.reverse()
						.find((tc) => tc.name === event.name && !tc.result)
					if (last) last.result = result
					yield { type: 'tool_result', tool: event.name, result }
					// 通知前端配置已变更
					yield { type: 'config_changed' }
					break
				}
			}
		}

		// 4. 保存消息到数据库
		const now = new Date().toISOString()
		await db().insert(chatMessagesTable).values({
			id: crypto.randomUUID(),
			sessionId,
			role: 'user',
			content: userMessage,
			createdAt: now,
		})

		await db()
			.insert(chatMessagesTable)
			.values({
				id: crypto.randomUUID(),
				sessionId,
				role: 'assistant',
				content: fullContent,
				reasoningContent: reasoningContent || null,
				toolCalls: JSON.stringify(toolCalls),
				createdAt: new Date().toISOString(),
			})

		// 更新 session 的 updatedAt
		await db()
			.update(chatSessions)
			.set({ updatedAt: now })
			.where(eq(chatSessions.id, sessionId))

		yield { type: 'done', content: fullContent, toolCalls, sessionId }
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		console.error('Agent run error:', message)
		yield { type: 'error', message }
	}
}
