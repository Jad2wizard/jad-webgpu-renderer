import { ChatOpenAI } from '@langchain/openai'
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db'
import { projects, layers, chatMessages as chatMessagesTable, chatSessions } from '../db/schema'
import { ALL_TOOLS } from './tools'
import { config } from '../config'

// ---- 模型 ----
// 通过 thinking: { type: "disabled" } 关闭 DeepSeek 思考模式，
// 模型不再生成 reasoning_content，避免历史会话 400 错误。

console.log(`\n======================\n${config.openaiModel}\n${config.openaiBaseUrl}`)
const model = new ChatOpenAI({
	model: config.openaiModel,
	apiKey: config.openaiApiKey,
	configuration: {
		baseURL: config.openaiBaseUrl,
	},
	modelKwargs: {
		thinking: { type: 'disabled' },
	},
	temperature: 0.3,
	maxTokens: 4096,
	timeout: 60000,
})

// ---- System Prompt ----

const SYSTEM_PROMPT = `你是一个专业的地图可视化助手。你可以帮助用户通过自然语言修改地图的渲染样式和视角。

## 你的能力
- 修改地图视口（中心点、缩放级别）
- 修改散点图、轨迹图、热力图的样式（颜色、大小、线宽、透明度等）
- 管理图层（显隐、排序、删除）
- **图层类型转换**：在散点图和热力图之间切换，复用同一份数据
- **散点图层数据映射**：将数据列映射到颜色通道（RGBA）或半径，实现数据驱动的可视化

## 散点图层数据映射
数据映射允许你用数据文件中的列值来控制每个散点的颜色和大小，而不是使用统一的默认值。
- 使用 get_current_config 查看图层时，fields 对象中的字段名对应数据列的索引号
- **colorMapping**：将 4 个数据列分别映射到 RGBA 四个颜色通道。r/g/b/a 均为数据列的索引（从 0 开始）。可选 range [min, max] 用于将数据值归一化到 0-1
- **radiusMapping**：将 1 个数据列映射为散点半径（像素）。field 为数据列索引。可选 range [min, max] 限制半径范围
- 设置数据映射后，将覆盖图层默认的颜色和半径设置（数据映射优先级更高）
- 清除映射后，图层恢复使用默认颜色和半径

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
0. **你必须调用提供的工具（Tools）来实际修改地图的配置，绝对不要仅仅在回复中说你修改了！**
1. 在修改配置之前，先用 get_current_config 了解当前状态（如果尚未提供）。
2. 如果用户没有指定图层，先用 list_layers 列出可用图层。
3. 半径的单位是屏幕像素，范围 1-255。
4. 缩放级别范围 1-18。
5. 混合模式：normalBlending(正常)、additiveBlending(叠加增亮)、subtractiveBlending(相减变暗)。
5.5. 散点图和热力图可以互相转换，使用 convert_layer_type 工具。转换后半径和混合模式设置会保留。
6. 必须调用相应的修改工具后，再用简洁的中文确认改动。
7. 如果用户说的颜色名称不在约定列表中，使用你最接近的估计值。`

// ---- Prompt 模板 ----

const prompt = ChatPromptTemplate.fromMessages([
	['system', SYSTEM_PROMPT],
	new MessagesPlaceholder('chat_history'),
	new HumanMessage('把散点颜色改成红色'),
	new AIMessage({
		content: '',
		tool_calls: [
			{
				name: 'set_scatter_style',
				args: {
					projectId: '真实的projectId',
					layerId: '真实的layerId',
					color: [1, 0, 0, 1],
				},
				id: 'call_example1',
			},
		],
	}),
	new ToolMessage({
		content: '已更新散点图层"test"的样式',
		tool_call_id: 'call_example1',
	}),
	new AIMessage('我已经把散点颜色改成红色了✅'),
	new HumanMessage('用第3、4、5、6列的数据作为散点的RGBA颜色'),
	new AIMessage({
		content: '',
		tool_calls: [
			{
				name: 'set_scatter_data_mapping',
				args: {
					projectId: '真实的projectId',
					layerId: '真实的layerId',
					colorMapping: { r: 3, g: 4, b: 5, a: 6 },
				},
				id: 'call_example2',
			},
		],
	}),
	new ToolMessage({
		content: '散点图层"test"：已设置颜色映射（R:列3, G:列4, B:列5, A:列6）',
		tool_call_id: 'call_example2',
	}),
	new AIMessage('已设置数据颜色映射✅，现在散点的颜色由第3-6列数据驱动'),
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
			return new AIMessage(m.content)
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

	const input = `当前项目的 Project ID: ${projectId}\n当前项目的地图配置：\n${JSON.stringify(currentConfig, null, 2)}\n\n用户请求：${userMessage}`

	// 3. 流式执行
	let fullContent = ''
	const toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: string }> = []
	// 在 agent 开始执行前记录用户消息时间戳，避免与 assistant 消息时间相同
	const userCreatedAt = new Date().toISOString()

	try {
		const stream = await executor.streamEvents(
			{ input, chat_history: chatHistory },
			{ version: 'v2' }
		)

		for await (const event of stream) {
			// 诊断日志
			if (event.event !== 'on_chain_start' && event.event !== 'on_chain_end') {
				console.log('[agent] event=%s name=%s', event.event, event.name || '-')
			}
			switch (event.event) {
				case 'on_chat_model_stream': {
					const chunk = event.data.chunk
					console.log(chunk)
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
		await db().insert(chatMessagesTable).values({
			id: crypto.randomUUID(),
			sessionId,
			role: 'user',
			content: userMessage,
			createdAt: userCreatedAt,
		})

		const assistantCreatedAt = new Date().toISOString()
		await db()
			.insert(chatMessagesTable)
			.values({
				id: crypto.randomUUID(),
				sessionId,
				role: 'assistant',
				content: fullContent,
				toolCalls: JSON.stringify(toolCalls),
				createdAt: assistantCreatedAt,
			})

		// 更新 session 的 updatedAt
		await db()
			.update(chatSessions)
			.set({ updatedAt: assistantCreatedAt })
			.where(eq(chatSessions.id, sessionId))

		yield { type: 'done', content: fullContent, toolCalls, sessionId }
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		console.error('Agent run error:', message)
		yield { type: 'error', message }
	}
}
